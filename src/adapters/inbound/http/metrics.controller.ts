import { Controller, Get, Header } from '@nestjs/common';
import { MetricsRegistry } from '../../outbound/observability/metrics.registry';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsRegistry) {}

  @Get()
  @Header('content-type', 'text/plain; version=0.0.4')
  scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
