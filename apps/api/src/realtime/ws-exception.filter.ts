import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Socket } from 'socket.io';

@Catch(HttpException)
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : (response as { message?: string }).message;

    this.logger.warn(
      `${exception.getStatus()} ${message ?? exception.message} (socket ${client.id})`,
    );

    client.emit('error', {
      status: exception.getStatus(),
      message: message ?? exception.message,
    });
  }
}
