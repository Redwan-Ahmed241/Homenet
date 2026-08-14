import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import type { IncomingMessage, ServerResponse } from 'http';

let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

    app.enableCors({
      origin: true,
      credentials: true,
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

    await app.init();
  }
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const nestApp = await bootstrap();
  const httpAdapter = nestApp.getHttpAdapter();
  const instance = httpAdapter.getInstance();
  instance(req, res);
}
