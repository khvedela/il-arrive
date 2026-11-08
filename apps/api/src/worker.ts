import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './modules/worker/worker.module';

async function bootstrap() {
  await NestFactory.create(WorkerModule);
  console.log('Worker process started');
}

bootstrap().catch(console.error);
