import dotenv from "dotenv";
import { Context, Effect, Layer } from "effect";

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly nodeEnv: string;
}

export class AppConfigService extends Context.Service<
  AppConfigService,
  AppConfig
>()("AppConfig") {}

const parsePort = (port: string | undefined) => {
  if (!port) {
    return 3001;
  }

  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return parsedPort;
};

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

const makeConfig = Effect.sync(() => {
  dotenv.config();

  return {
    port: parsePort(process.env.PORT),
    databaseUrl: requireEnv("DATABASE_URL"),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
});

export const AppConfigLive = Layer.effect(AppConfigService, makeConfig);
export const config = Effect.runSync(makeConfig);
