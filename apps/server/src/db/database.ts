import { Context, Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { AppConfigService } from "../config.js";
import { DB } from "./generated.js";

export class Database extends Context.Service<Database, Kysely<DB>>()("Database") {}

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
