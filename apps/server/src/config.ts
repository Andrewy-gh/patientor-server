import { Config, Context, Layer } from "effect";

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly nodeEnv: string;
  readonly tracingEnabled: boolean;
  readonly otlpEndpoint: string;
}

export class AppConfigService extends Context.Service<AppConfigService, AppConfig>()("AppConfig") {}

const appConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3001)),
  databaseUrl: Config.string("DATABASE_URL"),
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
  tracingEnabled: Config.boolean("TRACING_ENABLED").pipe(Config.withDefault(false)),
  otlpEndpoint: Config.string("OTEL_EXPORTER_OTLP_ENDPOINT").pipe(
    Config.withDefault("http://localhost:4318"),
  ),
});

export const AppConfigLive = Layer.effect(AppConfigService)(appConfig);
