import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { InvalidCursorError } from '../../../application/use-cases/transaction-cursor';

@Catch(InvalidCursorError)
export class InvalidCursorFilter implements ExceptionFilter {
  catch(error: InvalidCursorError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({ statusCode: HttpStatus.BAD_REQUEST, message: error.message });
  }
}
