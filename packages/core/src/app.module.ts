import { Module } from "@nestjs/common";
import { StorageModule } from "./shared/storage/storage.module";
import { OutputModule } from "./shared/output";
import { ConfigModule } from "@nestjs/config";
import { configLoaders, getEnvFilePaths } from "./config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      envFilePath: getEnvFilePaths(),
    }),
    StorageModule.forFeature(),
    OutputModule,
  ],
})
export class AppModule {}
