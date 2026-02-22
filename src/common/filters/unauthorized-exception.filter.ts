import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Filtro global para errores 401.
 * En producción responde como si la ruta no existiera (nginx 404),
 * así no se revela que el endpoint existe pero requiere autenticación.
 */
@Catch(UnauthorizedException)
export class UnauthorizedExceptionFilter implements ExceptionFilter {
  private readonly fakeNginx404 = [
    '<html>',
    '<head><title>404 Not Found</title></head>',
    '<body>',
    '<center><h1>404 Not Found</h1></center>',
    '<hr><center>nginx</center>',
    '</body>',
    '</html>',
  ].join('\n');

  catch(_exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // En producción, fingimos que la ruta no existe
      response
        .status(404)
        .setHeader('Server', 'nginx')
        .setHeader('Content-Type', 'text/html')
        .send(this.fakeNginx404);
    } else {
      // En desarrollo, devolvemos el 401 normal para poder debuggear
      response.status(401).json({
        statusCode: 401,
        message: 'Unauthorized',
      });
    }
  }
}
