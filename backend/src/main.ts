import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');

  const corsRaw = config.get<string>('CORS_ORIGIN');
  const origin =
    !corsRaw || corsRaw === '*'
      ? true
      : corsRaw.includes(',')
        ? corsRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : corsRaw;
  app.enableCors({ origin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('PORT') ?? 4000);
  await app.listen(port);
  console.log(`RHN CRM API listening on :${port}`);
}

void bootstrap();
