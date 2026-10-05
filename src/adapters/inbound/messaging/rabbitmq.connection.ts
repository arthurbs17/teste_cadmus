import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ChannelModel, ConfirmChannel, connect } from 'amqplib';

@Injectable()
export class RabbitMqConnection implements OnModuleDestroy {
  private model: ChannelModel | null = null;

  async open(url: string): Promise<ConfirmChannel> {
    this.model = await connect(url);

    this.model.on('close', () => {
      this.model = null;
    });

    return this.model.createConfirmChannel();
  }

  async onModuleDestroy(): Promise<void> {
    await this.model?.close();
  }
}
