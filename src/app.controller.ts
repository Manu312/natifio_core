import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  @Get()
  root(@Res() res: Response) {
    // Simula una respuesta genérica de servidor nginx — no revela que es una API
    res.status(404).setHeader('Server', 'nginx').setHeader('Content-Type', 'text/html').send(
      '<html>\n<head><title>404 Not Found</title></head>\n<body>\n<center><h1>404 Not Found</h1></center>\n<hr><center>nginx</center>\n</body>\n</html>\n',
    );
  }
}
