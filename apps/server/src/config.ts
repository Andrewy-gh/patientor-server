import { Config, Context, Layer } from "effect";

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly nodeEnv: string;
}

export class AppConfigService extends Context.Service<AppConfigService, AppConfig>()("AppConfig") {}

const appConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3001)),
  databaseUrl: Config.string("DATABASE_URL"),
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
});

export const AppConfigLive = Layer.effect(AppConfigService)(appConfig);
