import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./api/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT ?? 8000));
}

void bootstrap();
