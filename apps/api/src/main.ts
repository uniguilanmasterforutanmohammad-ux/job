import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/configuration.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppConfig>);
  const logger = new Logger('Bootstrap');

  app.useLogger(app.get(PinoLogger));

  // Security & platform middleware
  app.use(
    helmet({
      contentSecurityPolicy: config.get('isProd', { infer: true }) ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: [config.get('appUrl', { infer: true }) as string],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  if (!config.get('isProd', { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Business Platform API')
      .setDescription('پلتفرم جامع مدیریت کسب‌وکارهای خدماتی — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true }) as number;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 API running on http://localhost:${port}/api/v1`);
  if (!config.get('isProd', { infer: true })) {
    logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
