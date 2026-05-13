# 02 — Config and Layers

Patientor should let Effect own configuration instead of scattering `process.env` reads.

Current server app already follows the right direction in `apps/server/src/config.ts`:

```ts
import { Config, Context, Effect, Layer } from "effect";

export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly nodeEnv: string;
}

export class AppConfigService extends Context.Service<
  AppConfigService,
  AppConfig
>()("AppConfig") {}

const appConfig = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(3001)),
  databaseUrl: Config.string("DATABASE_URL"),
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
});

export const AppConfigLive = Layer.effect(AppConfigService)(
  Effect.gen(function* () {
    return yield* appConfig;
  }),
);
```

## Rule: validate config once, provide it everywhere

Routes, services, migrations, and seed scripts should depend on `AppConfigService`, not `process.env`.

## Loading `.env`

At the app/script boundary:

```ts
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), {
  asPrimary: true,
});

const MainLive = HttpServerLive.pipe(
  Layer.provide(AppLive),
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);
```

`ConfigProvider.fromDotEnv()` reads `.env` through Effect. It does not mutate `process.env`, which is good: config flow stays visible.

## Layer dependency graph

`DatabaseLive` needs `AppConfigService`, so wire it like this:

```ts
import { Layer } from "effect";
import { AppConfigLive } from "./config.js";
import { DatabaseLive } from "./db/database.js";

export const AppLive = DatabaseLive.pipe(
  Layer.provideMerge(AppConfigLive),
);
```

Use `Layer.provideMerge` here because the database depends on config and the final app still needs both services available.

## Test config

For tests, provide a fixed config layer:

```ts
import { Layer } from "effect";
import { AppConfigService } from "../src/config.js";

export const TestConfigLive = Layer.succeed(AppConfigService)({
  port: 0,
  databaseUrl: "postgres://test:test@localhost:5432/patientor_test",
  nodeEnv: "test",
});
```
