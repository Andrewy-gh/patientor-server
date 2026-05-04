# Effect v4 Migration Reference

This guide shows the native Effect v4 shape for migrating this server away from Express/Kysely globals. The goal is not a full rewrite in one pass. The goal is to move the main IO boundaries into Effect first: config, database, dependency injection, and HTTP server startup.

The user impact should be boring in the best way: the API keeps returning the same JSON, but the code becomes easier to test because config, database access, and routes are wired through layers instead of hidden imports.

## Current Constraints

- Package is ESM, so relative TypeScript imports need `.js` extensions.
- TypeScript uses `NodeNext`.
- Effect is `effect@4.0.0-beta.60`.
- Use Effect v4 `Context.Service`, not `Context.Tag`.
- Use `@effect/vitest@4.0.0-beta.60` for tests. It provides Effect-aware `it.effect`, `layer`, and `assert` helpers on top of the Vitest runner.
- The `vitest` CLI still runs tests because `@effect/vitest` has Vitest as a peer dependency. Keep the `npm test` script as `vitest run`, but import test APIs from `@effect/vitest`, not `vitest`.
- The repo currently depends on `effect`, but native Node HTTP examples require `@effect/platform-node`.
- Do not install `@effect/platform-node` without a version. The current `latest` line targets Effect 3, which is wrong for this repo.

Install the Effect test integration before writing migrated tests:

```bash
npm install --save-dev @effect/vitest@4.0.0-beta.60
```

Install the platform package before switching the HTTP server:

```bash
npm install @effect/platform-node@4.0.0-beta.60
```

This keeps `@effect/platform-node` aligned with `effect@^4.0.0-beta.60`.

I tried the repo-local `effect-solutions` command through `npm exec -- effect-solutions list`, but the binary reports `Unsupported platform: win32-x64` on this machine. The examples below are based on the local Effect v4 source checkout at `C:\Users\lenny\.local\share\effect-solutions\effect`, especially the `ai-docs/src/51_http-server` examples and the platform-node HTTP tests.

## Migration Order

1. Replace manual env parsing with native `Config`.
2. Wrap Kysely in a `Database` service layer.
3. Convert one service at a time to consume dependencies with `yield* Database`.
4. Replace one Express route at a time with `HttpRouter` routes.
5. Launch the app with `Layer.launch(...).pipe(NodeRuntime.runMain)`.

That keeps the migration small while still using native Effect patterns where they matter most.

## 1. Native Config

Effect has native config handling. `Config` describes required values and validation. `ConfigProvider` decides where values come from. By default, Effect can read from environment variables.

Keep `dotenv` as a Node startup concern if local development still relies on `.env`. Effect reads environment variables, but it does not need to own loading `.env` files.

```ts
// src/config.ts
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

const makeConfig = Effect.gen(function* () {
  return yield* appConfig;
});

export const AppConfigLive = Layer.effect(AppConfigService)(makeConfig);
```

For tests, provide a controlled config value:

```ts
import { Layer } from "effect";
import { AppConfigService } from "../src/config.js";

export const TestConfigLive = Layer.succeed(AppConfigService)({
  port: 0,
  databaseUrl: "postgres://test:test@localhost:5432/test",
  nodeEnv: "test",
});
```

Use `ConfigProvider.layer(...)` when you want to test the config parser itself:

```ts
import { ConfigProvider, Effect } from "effect";
import { AppConfigLive, AppConfigService } from "../src/config.js";

const provider = ConfigProvider.fromEnv({
  env: {
    PORT: "3001",
    DATABASE_URL: "postgres://user:pass@localhost:5432/patientor",
    NODE_ENV: "test",
  },
});

const program = Effect.gen(function* () {
  const config = yield* AppConfigService;
  return config.port;
}).pipe(
  Effect.provide([
    AppConfigLive,
    ConfigProvider.layer(provider),
  ]),
);
```

## 2. Kysely Database Service

The database should be an Effect service because it is a shared IO dependency. Code that queries the database should ask for `Database`; it should not import a global `db`.

```ts
// src/db/database.ts
import { Context, Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { AppConfigService } from "../config.js";
import { DB } from "./generated.js";

export class Database extends Context.Service<Database, Kysely<DB>>()(
  "Database",
) {}

const makeDatabase = Effect.gen(function* () {
  const config = yield* AppConfigService;

  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: config.databaseUrl,
      }),
    }),
  });
});

export const DatabaseLive = Layer.effect(Database)(makeDatabase);
```

Notation reminder for the service declaration:

```ts
export class Database extends Context.Service<Database, Kysely<DB>>()(
  "Database",
) {}
```

The class name `Database` is the service key imported by application code. The
first generic, also `Database`, is the Effect identifier type for that key. The
second generic, `Kysely<DB>`, is the value type returned when code asks for the
service with `yield* Database`.

So `yield* Database` gives a `Kysely<DB>` client, not an instance of the empty
`Database` class. The string `"Database"` is the runtime key name and should
usually match the class name for readability.

If you want Effect to own shutdown, model the database as an acquired resource:

```ts
const makeDatabase = Effect.gen(function* () {
  const config = yield* AppConfigService;

  return yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Kysely<DB>({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: config.databaseUrl,
            }),
          }),
        }),
    ),
    (db) => Effect.promise(() => db.destroy()),
  );
});

export const DatabaseLive = Layer.effect(Database)(makeDatabase);
```

Use the acquired version once the server is launched with `Layer.launch`; then Effect can release the database when the process shuts down.

## 3. Service Consuming the Database

Migrated services should return Effects. That makes dependencies visible in the type and lets tests provide fake layers.

```ts
// src/services/diagnosisService.ts
import { Effect } from "effect";
import { Database } from "../db/database.js";

export const getDiagnoses = Effect.gen(function* () {
  const db = yield* Database;

  const diagnoses = yield* Effect.promise(() =>
    db
      .selectFrom("diagnoses")
      .select(["code", "name", "latin"])
      .orderBy("code")
      .execute(),
  );

  return diagnoses.map((diagnosis) => ({
    code: diagnosis.code,
    name: diagnosis.name,
    ...(diagnosis.latin ? { latin: diagnosis.latin } : {}),
  }));
});
```

Keep the Kysely query plain. The useful change is dependency ownership, not rewriting every query.

## 4. Native HTTP Routes

Native Effect HTTP uses `HttpRouter` and `HttpServerResponse` from `effect/unstable/http`, plus `NodeHttpServer` and `NodeRuntime` from `@effect/platform-node`.

Start with the simple routes before moving request body parsing and patient validation.

```ts
// src/http/routes.ts
import { Effect } from "effect";
import {
  HttpRouter,
  HttpServerResponse,
} from "effect/unstable/http";
import * as diagnosisService from "../services/diagnosisService.js";

const pingRoute = HttpRouter.route(
  "GET",
  "/api/ping",
  HttpServerResponse.text("pong"),
);

const diagnosesRoute = HttpRouter.route(
  "GET",
  "/api/diagnoses",
  diagnosisService.getDiagnoses.pipe(
    Effect.flatMap((diagnoses) => HttpServerResponse.json(diagnoses)),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

export const HttpRoutes = HttpRouter.addAll([
  pingRoute,
  diagnosesRoute,
]);
```

If TypeScript complains about `HttpRouter.addAll` shape, use the lower-level builder style from the Effect tests:

```ts
export const HttpRoutes = HttpRouter.use((router) =>
  Effect.gen(function* () {
    yield* router.add("GET", "/api/ping", HttpServerResponse.text("pong"));
    yield* router.add(
      "GET",
      "/api/diagnoses",
      diagnosisService.getDiagnoses.pipe(
        Effect.flatMap((diagnoses) => HttpServerResponse.json(diagnoses)),
      ),
    );
  }),
);
```

Prefer the first style if it typechecks cleanly in this repo; prefer the builder style when adding many related routes.

## 5. App Layer and Server Startup

This is the native Effect replacement for `app.listen(...)`.

```ts
// src/layers.ts
import { Layer } from "effect";
import { AppConfigLive } from "./config.js";
import { DatabaseLive } from "./db/database.js";

export const AppLive = Layer.mergeAll(
  AppConfigLive,
  DatabaseLive,
);
```

```ts
// src/http/server.ts
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { createServer } from "node:http";
import { AppConfigService } from "../config.js";
import { HttpRoutes } from "./routes.js";

const NodeServerLive = Layer.effect(HttpServer.HttpServer)(Effect.gen(function* () {
  const config = yield* AppConfigService;
  return NodeHttpServer.make(createServer, { port: config.port });
})).pipe(
  Layer.provide(NodeHttpServer.layerHttpServices),
);

export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(
  Layer.provide(NodeServerLive),
);
```

Depending on the exact `@effect/platform-node` beta API available after install, the server layer may also be expressible directly:

```ts
export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);
```

The dynamic-port version is better for this repo because the port comes from native config.

```ts
// src/index.ts
import { NodeRuntime } from "@effect/platform-node";
import dotenv from "dotenv";
import { Layer } from "effect";
import { AppLive } from "./layers.js";
import { HttpServerLive } from "./http/server.js";

dotenv.config();

const MainLive = HttpServerLive.pipe(
  Layer.provide(AppLive),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
```

`Layer.launch` keeps the server alive and manages resource lifetime. `NodeRuntime.runMain` is the Node process entry point.

## 6. Where the Main Effect APIs Belong

`Config` belongs in `src/config.ts` for parsing environment-backed settings.

`Context.Service` belongs at dependency boundaries: config, database, external clients, and later domain services if they carry dependencies.

`Layer.effect` belongs when constructing a dependency requires Effect logic, such as reading config or acquiring a database client.

`Layer.succeed` belongs in tests and simple fixed services where the value already exists.

`Effect.provide` belongs in tests, scripts, and temporary bridges. Once the HTTP server is native, app startup should mostly use `Layer.provide` and `Layer.launch`.

`Effect.runPromise` belongs at temporary boundaries while Express still exists. After switching to native HTTP, avoid scattering `runPromise` through route files.

`Effect.runSync` should mostly disappear. It is acceptable only for tiny synchronous legacy bridges during migration.

## 7. What to Leave Alone During the First Native Pass

Keep Kysely query builders. They are already type-safe and familiar.

Keep the generated database types in `src/db/generated.ts`.

Keep existing domain data shapes unless a route migration needs schema validation.

Keep patient routes on Express until diagnoses proves the native route pattern. Then move one route group at a time.

Do not introduce repositories, managers, custom runtimes, or broad service abstractions just to look more Effect-like. The native Effect pieces already provide dependency injection, config, resource ownership, and server lifecycle.

## 8. Testing Pattern

Use `@effect/vitest` for migrated tests. It still runs through the Vitest CLI, but the test code gets Effect-native helpers. Put tests in the existing `tests/` folder, and put reusable test layers in `tests/support/` when more than one test file needs them.

For plain synchronous tests, import from `@effect/vitest` and use `assert`:

```ts
import { assert, test } from "@effect/vitest";

test("validates patient SSN shape", () => {
  assert.isTrue(validateString("090786-122X"));
  assert.isFalse(validateString("abcdef-1234"));
});
```

For Effect service tests, use `it.effect` and provide fake dependencies with `Layer.succeed`.

```ts
import { Effect, Layer } from "effect";
import { assert, describe, it } from "@effect/vitest";
import { Database } from "../src/db/database.js";
import { getDiagnoses } from "../src/services/diagnosisService.js";

describe("getDiagnoses", () => {
  it.effect("returns diagnoses without empty latin fields", () =>
    Effect.gen(function* () {
      const fakeDb = {
        selectFrom: () => ({
          select: () => ({
            orderBy: () => ({
              execute: async () => [
                { code: "A01", name: "Test", latin: null },
              ],
            }),
          }),
        }),
      };

      const result = yield* getDiagnoses.pipe(
        Effect.provide(Layer.succeed(Database)(fakeDb as never)),
      );

      assert.deepStrictEqual(result, [{ code: "A01", name: "Test" }]);
    }),
  );
});
```

Use `layer(...)` from `@effect/vitest` when a group of tests should share one constructed layer:

```ts
import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Database } from "../src/db/database.js";

layer(Layer.succeed(Database)(fakeDb as never))("Database", (it) => {
  it.effect("can access the shared fake database", () =>
    Effect.gen(function* () {
      const db = yield* Database;
      assert.strictEqual(typeof db.selectFrom, "function");
    }),
  );
});
```

For tests that need virtual time, import `TestClock` from `effect/testing`:

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

it.effect("controls time", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(
      Effect.sleep(60_000).pipe(Effect.as("done" as const)),
    );

    yield* TestClock.adjust(60_000);

    assert.strictEqual(yield* Fiber.join(fiber), "done");
  }),
);
```

For HTTP tests after installing `@effect/platform-node`, use `NodeHttpServer.layerTest` and `HttpClient`, following the Effect platform-node test pattern.

## 9. Decision Points

Move to native HTTP when you want Effect to own request lifecycle, interruption, structured errors, and server shutdown.

Keep Express temporarily if the product risk is route behavior churn. In that case, bridge only at the route edge with `Effect.runPromise`.

Use native `HttpApi` later if you want schema-first endpoints and generated clients. For this migration, `HttpRouter` is the smaller step.

Use `Schema` for request and response validation once route behavior is stable. Do not force every existing type through Schema on day one.
