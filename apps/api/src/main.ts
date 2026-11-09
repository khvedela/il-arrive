import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalErrorFilter } from './common/global-error.filter';
import pinoHttp from 'pino-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Honour X-Forwarded-For only from explicitly trusted proxies. TRUST_PROXY is a hop count (1 = nginx) or an
  // express address list (e.g. "loopback, 172.16.0.0/12"). Default is off: otherwise any direct caller could
  // spoof its address and dodge per-client throttling.
  const trustProxy = String(configService.get('TRUST_PROXY', '0')).trim();
  if (trustProxy && trustProxy !== '0' && trustProxy.toLowerCase() !== 'false') {
    app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  // Pino structured logger
  app.use(pinoHttp({
    genReqId: () => crypto.randomUUID(),
  }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global error filter
  app.useGlobalFilters(new GlobalErrorFilter());

  // OpenAPI
  const documentConfig = new DocumentBuilder()
    .setTitle('Il Arrive API')
    .setDescription('Real-time arrival tracking API')
    .setVersion('1.0')
    .addCookieAuth()
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Sentry (no-op if no DSN)
  const sentryDsn = configService.get('SENTRY_DSN');
  if (sentryDsn) {
    // Sentry integration would go here
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get('API_PORT', 3000);
  const host = configService.get('API_HOST', '0.0.0.0');
  await app.listen(port, host);
  console.log(`API running on http://${host}:${port}`);
}

bootstrap().catch(console.error);
