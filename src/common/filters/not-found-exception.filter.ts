import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global que intercepta rutas no encontradas y errores de autenticación.
 * Responde con una página HTML genérica de nginx 404 para no revelar
 * que hay una API NestJS detrás.
 */
@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  private readonly fakeNginx404 = [
    '<html>',
    '<head><title>404 Not Found</title></head>',
    '<body>',
    '<center><h1>404 Not Found</h1></center>',
    '<hr><center>nginx</center>',
    '</body>',
    '</html>',
  ].join('\n');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response
      .status(404)
      .setHeader('Server', 'nginx')
      .setHeader('Content-Type', 'text/html')
      .send(this.fakeNginx404);
  }
}
