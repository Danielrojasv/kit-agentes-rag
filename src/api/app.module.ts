import { Module } from "@nestjs/common";

import { KitController } from "./kit.controller";
import { KitService } from "./kit.service";

@Module({
  controllers: [KitController],
  providers: [KitService],
})
export class AppModule {}
