import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — allow frontend dev servers, local LAN devices, and production domains
  app.enableCors({
    origin: [
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://localhost:8085',
      'http://localhost:8086',
      'http://192.168.68.105:8081',
      'http://192.168.68.105:8082',
      'http://192.168.68.105:8083',
      'http://192.168.68.105:8084',
      'http://192.168.68.105:8085',
      'http://192.168.68.105:8086',
      'https://www.homenetbd.com',
      'https://homenetbd.com',
      'https://www.homenet-bd.com',
      'https://homenet-bd.com',
    ],
    credentials: true,
  });

  // Support /api prefix transparently if requested by clients (e.g. /api/v1/* -> /v1/*)
  app.use((req: any, _res: any, next: any) => {
    if (typeof req.url === 'string' && req.url.startsWith('/api/v1')) {
      req.url = req.url.replace(/^\/api/, '');
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Homenet API')
    .setDescription('Homenet backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend server listening on http://0.0.0.0:${port}`);
}
bootstrap();

