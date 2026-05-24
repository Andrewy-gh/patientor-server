# Effect v4 Migration Reference

This guide records the native Effect v4 shape used to move this server away
from Express/Kysely globals. The server now runs on Effect HTTP and implements
the public contract from `@patientor/api`, so treat the older `HttpRouter`
examples below as background for legacy route files rather than the preferred
direction for new route work.

The user impact should be boring in the best way: the API keeps returning the same JSON, but the code becomes easier to test because config, database access, and routes are wired through layers instead of hidden imports.

## Current Constraints

- Package is ESM. Server source currently imports relative TypeScript modules
  with `.ts`; the server `tsconfig.json` uses `rewriteRelativeImportExtensions`
  so build output gets runtime-safe extensions.
- TypeScript uses `NodeNext`.
- Package manifests request `effect@^4.0.0-beta.65`; the current lockfile and
  installed `node_modules` resolve Effect packages to `4.0.0-beta.66`.
- Use Effect v4 `Context.Service`, not `Context.Tag`.
- Use Effect v4 `Effect.catch`, not `Effect.catchAll`. In this beta,
  `Effect.catch` is the public replacement for the Effect 3 `catchAll` API.
  Use `Effect.catchTag` when handling one tagged error type such as
  `DiagnosisReadError`.
- Use `@effect/vitest` for tests. It provides Effect-aware `it.effect`, `layer`, and `assert` helpers on top of the Vitest runner.
- The repo uses Vite+ test commands. Keep package scripts on `vp test`, but import test APIs from `@effect/vitest`, not `vitest`.
- The repo already depends on `@effect/platform-node` for native Node HTTP, Node services, and test servers.

If dependency versions drift, keep the Effect packages aligned with the
currently installed beta:

```bash
pnpm add -D --filter server @effect/vitest@4.0.0-beta.66
pnpm add --filter server @effect/platform-node@4.0.0-beta.66
```

This keeps `@effect/platform-node` aligned with the installed `effect` version.
Verify exact APIs against `apps/server/node_modules/effect` and
`apps/server/node_modules/@effect/platform-node`.

## Migration Order

1. Replace manual env parsing with native `Config`.
2. Wrap Kysely in a `Database` service layer.
3. Convert one service at a time to consume dependencies with `yield* Database`.
4. Implement public routes with the shared `PatientorApi` contract and
   `HttpApiBuilder`.
5. Launch the app with `Layer.launch(...).pipe(NodeRuntime.runMain)`.

That keeps the migration small while still using native Effect patterns where they matter most.

## 1. Native Config

Effect has native config handling. `Config` describes required values and validation. `ConfigProvider` decides where values come from. By default, Effect can read from environment variables.

For this migration, let Effect own local `.env` loading too. Use
`ConfigProvider.fromDotEnv()` at startup and add it to the main layer. This keeps
config parsing and config source selection in the same Effect-native path, and
it avoids mutating `process.env` with `dotenv.config()`.

Important behavior note: `ConfigProvider.fromDotEnv()` reads `.env` into an
Effect config provider. It does not globally update `process.env`. Code that
still reads `process.env` directly will not see those `.env` values unless it is
migrated to `Config` or you keep `dotenv` temporarily for that legacy path.

```ts
// src/config.ts
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
```

For tests, provide a controlled config value:

```ts
import { Layer } from "effect";
import { AppConfigService } from "../src/config.ts";

export const TestConfigLive = Layer.succeed(AppConfigService)({
  port: 0,
  databaseUrl: "postgres://test:test@localhost:5432/test",
  nodeEnv: "test",
  tracingEnabled: false,
  otlpEndpoint: "http://localhost:4318",
});
```

Use `ConfigProvider.layer(...)` when you want to test the config parser itself:

```ts
import { ConfigProvider, Effect } from "effect";
import { AppConfigLive, AppConfigService } from "../src/config.ts";

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
}).pipe(Effect.provide([AppConfigLive, ConfigProvider.layer(provider)]));
```

Use `ConfigProvider.fromDotEnv()` when the application should read local `.env`
values through Effect:

```ts
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), { asPrimary: true });

const MainLive = HttpServerLive.pipe(
  Layer.provide(AppLive),
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);
```

`fromDotEnv()` needs `NodeServices.layer` because it reads from the filesystem.
`layerAdd(..., { asPrimary: true })` makes `.env` values take priority over the
default environment provider for config lookups. Remove the package-level
`dotenv` dependency once no code path needs `dotenv.config()`.

## 2. Kysely Database Service

The database should be an Effect service because it is a shared IO dependency. Code that queries the database should ask for `Database`; it should not import a global `db`.

```ts
// src/db/database.ts
import { Context, Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { AppConfigService } from "../config.ts";
import { DB } from "./generated.ts";

export class Database extends Context.Service<Database, Kysely<DB>>()("Database") {}

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
export class Database extends Context.Service<Database, Kysely<DB>>()("Database") {}
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

Use `Effect.gen` directly for effect values, such as a startup program or a
route body. When exporting a reusable function that returns an Effect, prefer
`Effect.fnUntraced(function* (...) { ... })` over an arrow function that returns
`Effect.gen(...)`. This follows the local Effect source checkout guidance and
keeps the generator body readable while making the export itself the
Effect-returning function.

```ts
// src/services/diagnosisService.ts
import { Data, Effect } from "effect";
import { Database } from "../db/database.ts";

export class DiagnosisReadError extends Data.TaggedClass("DiagnosisReadError")<{
  readonly cause: unknown;
}> {}

export const getDiagnoses = Effect.gen(function* () {
  const db = yield* Database;

  const diagnoses = yield* Effect.tryPromise({
    try: () =>
      db.selectFrom("diagnoses").select(["code", "name", "latin"]).orderBy("code").execute(),
    catch: (cause) => new DiagnosisReadError({ cause }),
  });

  return diagnoses.map((diagnosis) => ({
    code: diagnosis.code,
    name: diagnosis.name,
    ...(diagnosis.latin ? { latin: diagnosis.latin } : {}),
  }));
});
```

For a service function with parameters, use `Effect.fnUntraced`:

```ts
export const getPatient = Effect.fnUntraced(function* (id: string) {
  const db = yield* Database;
  const patient = yield* Effect.tryPromise({
    try: () =>
      db.selectFrom("patients").select(["id", "name"]).where("id", "=", id).executeTakeFirst(),
    catch: (cause) => new PatientReadError({ cause }),
  });

  if (!patient) {
    return undefined;
  }

  return patient;
});
```

Keep the Kysely query plain. The useful change is dependency ownership, not rewriting every query.

If a service can fail, give that failure a narrow tagged error. Tagged errors
make route behavior explicit and let routes handle known failures without
catching every possible defect.

```ts
import { Data } from "effect";

export class DiagnosisReadError extends Data.TaggedClass("DiagnosisReadError")<{
  readonly cause: unknown;
}> {}
```

## 4. Native HTTP Routes

Native Effect HTTP uses `HttpRouter` and `HttpServerResponse` from
`effect/unstable/http`, plus `NodeHttpServer` and `NodeRuntime` from
`@effect/platform-node`. Patientor's preferred route implementation is now
`HttpApiBuilder` through `packages/api/src/patientor-api.ts`; use this section
only for understanding or temporarily maintaining the older `http.ts` route
files.

Start with the simple routes before moving request body parsing and patient validation.

```ts
// src/http/routes.ts
import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { getDiagnoses } from "../diagnoses/service.ts";

const pingRoute = HttpRouter.route("GET", "/api/v1/ping", HttpServerResponse.text("pong"));

const diagnosesRoute = HttpRouter.route(
  "GET",
  "/api/v1/diagnoses",
  getDiagnoses.pipe(
    Effect.flatMap((diagnoses) => HttpServerResponse.json(diagnoses)),
    Effect.catchTag("DiagnosisReadError", (error) =>
      Effect.sync(() => {
        console.error(error);
        return HttpServerResponse.empty({ status: 500 });
      }),
    ),
  ),
);

export const HttpRoutes = HttpRouter.addAll([pingRoute, diagnosesRoute]);
```

If TypeScript complains about `HttpRouter.addAll` shape, use the lower-level builder style from the Effect tests:

```ts
export const HttpRoutes = HttpRouter.use((router) =>
  Effect.gen(function* () {
    yield* router.add("GET", "/api/v1/ping", HttpServerResponse.text("pong"));
    yield* router.add(
      "GET",
      "/api/v1/diagnoses",
      getDiagnoses.pipe(Effect.flatMap((diagnoses) => HttpServerResponse.json(diagnoses))),
    );
  }),
);
```

Prefer the first style if it typechecks cleanly in this repo; prefer the builder style when adding many related routes.

The Express bridge below is historical. Keep it only if you are reading or
rescuing an old branch that still has Express in place. Do not use it for new
Patientor route work.

```ts
// src/routes/diagnoses.ts
import { Effect, Layer } from "effect";
import express from "express";
import { AppConfigLive } from "../config.ts";
import { DatabaseLive } from "../db/database.ts";
import { getDiagnoses } from "../diagnoses/service.ts";

const router = express.Router();
const RouteLive = DatabaseLive.pipe(Layer.provide(AppConfigLive));

router.get("/", (_req, res) => {
  void getDiagnoses.pipe(
    Effect.provide(RouteLive),
    Effect.flatMap((diagnoses) =>
      Effect.sync(() => {
        res.send(diagnoses);
      }),
    ),
    Effect.catchTag("DiagnosisReadError", (error) =>
      Effect.sync(() => {
        console.error(error);
        res.sendStatus(500);
      }),
    ),
    Effect.runPromise,
  );
});

export default router;
```

This is a temporary bridge. Once the HTTP server is native Effect, provide
`DatabaseLive` from the app layer instead of inside each route.

## 5. App Layer and Server Startup

This is the native Effect replacement for `app.listen(...)`.

```ts
// src/layers.ts
import { Layer } from "effect";
import { AppConfigLive } from "./config.ts";
import { DatabaseLive } from "./db/database.ts";
import { PatientRepositoryLive } from "./patients/repository.ts";

const DatabaseLayer = DatabaseLive.pipe(Layer.provideMerge(AppConfigLive));

export const AppLive = PatientRepositoryLive.pipe(Layer.provideMerge(DatabaseLayer));
```

Use `Layer.mergeAll` only for independent layers. It starts the layers in
parallel, so it should not combine a layer with another layer that needs its
service. Because `DatabaseLive` reads `AppConfigService`, wire config into the
database layer with `Layer.provideMerge`. That builds the dependency in the
right order and still keeps both services available to the app.

```ts
// src/http/server.ts
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "node:http";
import { AppConfigService } from "../config.ts";
import { HttpRoutes } from "./routes.ts";

const NodeServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return NodeHttpServer.layer(createServer, { port: config.port });
  }),
);

export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(Layer.provide(NodeServerLive));
```

For fixed-port tests or tiny examples, the server layer can also be provided
directly:

```ts
export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);
```

The dynamic-port version is better for this repo because the port comes from
native config. In the installed package, `NodeHttpServer.layer(...)` returns the
server layer, so `Layer.unwrap(...)` is the local helper that turns the
config-reading effect into the layer `HttpRouter.serve(...)` needs.

```ts
// src/index.ts
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import { HttpServerLive } from "./http/server.ts";
import { AppLive } from "./layers.ts";
import { ObservabilityLive } from "./observability.ts";

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), { asPrimary: true });

const MainLive = Layer.mergeAll(HttpServerLive, ObservabilityLive).pipe(
  Layer.provide(AppLive),
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
```

`Layer.launch` keeps the server alive and manages resource lifetime. `NodeRuntime.runMain` is the Node process entry point. `NodeServices.layer` provides the Node filesystem service needed by `ConfigProvider.fromDotEnv()`.

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

Use `@effect/vitest` for migrated tests. The server test script runs
`cross-env NODE_ENV=test vp test`, and the test code gets Effect-native helpers.
Put tests in `apps/server/tests/`, and put reusable test layers in a support
folder when more than one test file needs them.

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
import { Database } from "../src/db/database.ts";
import { getDiagnoses } from "../src/diagnoses/service.ts";

describe("getDiagnoses", () => {
  it.effect("returns diagnoses without empty latin fields", () =>
    Effect.gen(function* () {
      const fakeDb = {
        selectFrom: () => ({
          select: () => ({
            orderBy: () => ({
              execute: async () => [{ code: "A01", name: "Test", latin: null }],
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
import { Database } from "../src/db/database.ts";

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
    const fiber = yield* Effect.forkChild(Effect.sleep(60_000).pipe(Effect.as("done" as const)));

    yield* TestClock.adjust(60_000);

    assert.strictEqual(yield* Fiber.join(fiber), "done");
  }),
);
```

For HTTP tests after installing `@effect/platform-node`, use `NodeHttpServer.layerTest` and `HttpClient`, following the Effect platform-node test pattern.

## 9. Decision Points

Native HTTP is now the server default. Keep `HttpRouter` examples around only
for legacy route files and low-level tests; prefer `HttpApi` for new public API
work.

Use `HttpApi` when the route belongs to the shared product contract in
`@patientor/api`. It gives Patientor schema-first endpoints, generated OpenAPI,
and a typed client path for frontend work.

Use low-level `HttpRouter` directly only for short-lived compatibility code,
test scaffolding, or truly local routes that should not be part of the public
API contract.

Use `Schema` for untrusted request data and public response shapes. Keep pure
database mapping code in ordinary TypeScript when no runtime validation is
needed.
