import { BeforeApplicationShutdown, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { AppLogger } from '../../../application/ports/app-logger.port';
import { SyncConsentUseCase } from '../../../application/use-cases/sync-consent.use-case';
import { MetricsRegistry } from '../../outbound/observability/metrics.registry';
import { RabbitMqConnection } from './rabbitmq.connection';
import { DeliveryDecision, RetryPolicy, decideOnError, decideOnResult } from './retry-policy';
import { ATTEMPT_HEADER, SyncMessage, parseSyncMessage } from './sync-message';
import { SyncTopology, assertSyncTopology } from './sync-topology';

export interface SyncConsumerSettings {
  url: string;
  prefetch: number;
  topology: SyncTopology;
  retryPolicy: RetryPolicy;
}

@Injectable()
export class SyncConsentConsumer implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private channel: ConfirmChannel | null = null;
  private consumerTag: string | null = null;
  private shuttingDown = false;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly syncConsent: SyncConsentUseCase,
    private readonly metrics: MetricsRegistry,
    private readonly logger: AppLogger,
    private readonly settings: SyncConsumerSettings,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const channel = await this.connection.open(this.settings.url);

    channel.on('close', () => {
      if (this.shuttingDown) {
        return;
      }

      this.logger.error('sync.consumer.channel_closed');

      process.exitCode = 1;

      process.kill(process.pid, 'SIGTERM');
    });

    await assertSyncTopology(channel, this.settings.topology);

    await channel.prefetch(this.settings.prefetch);

    const { consumerTag } = await channel.consume(
      this.settings.topology.queue,
      (message) => message && this.track(this.handle(channel, message)),
      { noAck: false },
    );

    this.channel = channel;
    this.consumerTag = consumerTag;

    this.logger.info('sync.consumer.started', { queue: this.settings.topology.queue });
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag).catch(() => undefined);
    }

    await Promise.allSettled(this.inFlight);
  }

  private track(work: Promise<void>): void {
    this.inFlight.add(work);

    void work.finally(() => this.inFlight.delete(work));
  }

  private async handle(channel: ConfirmChannel, message: ConsumeMessage): Promise<void> {
    const syncMessage = parseSyncMessage(message);

    if (!syncMessage) {
      this.settle(channel, message, { action: 'dead_letter', reason: 'invalid message' }, null);
      return;
    }

    let decision: DeliveryDecision;

    try {
      const result = await this.syncConsent.execute(syncMessage);

      decision = decideOnResult(result, syncMessage.attempt, this.settings.retryPolicy);
    } catch (error) {
      decision = decideOnError(error, syncMessage.attempt, this.settings.retryPolicy);
    }

    try {
      if (decision.action === 'retry') {
        await this.scheduleRetry(channel, syncMessage, decision.nextAttempt, decision.delayMs);
      }

      this.settle(channel, message, decision, syncMessage);
    } catch (error) {
      this.logger.error('sync.consumer.settle_failed', {
        ...syncMessage,
        reason: error instanceof Error ? error.message : String(error),
      });

      channel.nack(message, false, true);
    }
  }

  private async scheduleRetry(
    channel: ConfirmChannel,
    syncMessage: SyncMessage,
    nextAttempt: number,
    delayMs: number,
  ): Promise<void> {
    const body = { consentId: syncMessage.consentId, correlationId: syncMessage.correlationId };

    channel.sendToQueue(this.settings.topology.retryQueue, Buffer.from(JSON.stringify(body)), {
      persistent: true,
      contentType: 'application/json',
      correlationId: syncMessage.correlationId,
      expiration: String(delayMs),
      headers: { [ATTEMPT_HEADER]: nextAttempt },
    });

    await channel.waitForConfirms();
  }

  private settle(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    decision: DeliveryDecision,
    syncMessage: SyncMessage | null,
  ): void {
    if (decision.action === 'dead_letter') {
      channel.nack(message, false, false);

      this.logger.error('sync.message.dead_lettered', { ...syncMessage, reason: decision.reason });
    } else {
      channel.ack(message);

      if (decision.action === 'retry') {
        this.logger.warn('sync.message.retry_scheduled', {
          ...syncMessage,
          nextAttempt: decision.nextAttempt,
          delayMs: decision.delayMs,
        });
      }
    }

    this.metrics.messages.inc({ outcome: decision.action });
  }
}
