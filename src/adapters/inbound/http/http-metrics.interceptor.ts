import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsRegistry } from '../../outbound/observability/metrics.registry';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsRegistry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();

    const request = http.getRequest<Request>();

    const stopTimer = this.metrics.httpDuration.startTimer({
      method: request.method,
      route: request.route?.path ?? 'unmatched',
    });

    return next.handle().pipe(
      tap({
        next: () => stopTimer({ status: String(http.getResponse<Response>().statusCode) }),
        error: (error: unknown) =>
          stopTimer({ status: String(error instanceof HttpException ? error.getStatus() : 500) }),
      }),
    );
  }
}
