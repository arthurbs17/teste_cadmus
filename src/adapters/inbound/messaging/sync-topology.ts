import { Channel } from 'amqplib';

export interface SyncTopology {
  queue: string;
  retryQueue: string;
  deadLetterQueue: string;
  deadLetterExchange: string;
}

export function syncTopology(queue: string): SyncTopology {
  return {
    queue,
    retryQueue: `${queue}.retry`,
    deadLetterQueue: `${queue}.dlq`,
    deadLetterExchange: `${queue}.dlx`,
  };
}

export async function assertSyncTopology(channel: Channel, topology: SyncTopology): Promise<void> {
  await channel.assertExchange(topology.deadLetterExchange, 'direct', { durable: true });

  await channel.assertQueue(topology.deadLetterQueue, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });

  await channel.bindQueue(topology.deadLetterQueue, topology.deadLetterExchange, topology.queue);

  await channel.assertQueue(topology.queue, {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      'x-dead-letter-exchange': topology.deadLetterExchange,
      'x-dead-letter-routing-key': topology.queue,
    },
  });

  await channel.assertQueue(topology.retryQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': topology.queue,
    },
  });
}
