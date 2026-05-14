# 03 — Database and Kysely

Kysely is already a good fit for Patientor. Effect should own the database client lifetime; Kysely should keep owning SQL query construction.

## Service boundary

Current shape:

```ts
import { Context, Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { AppConfigService } from "../config.js";
import { DB } from "./generated.js";

export class Database extends Context.Service<Database, Kysely<DB>>()("Database") {}

export const DatabaseLive = Layer.effect(Database)(
  Effect.gen(function* () {
    const config = yield* AppConfigService;

    return yield* Effect.acquireRelease(
      Effect.sync(
        () =>
          new Kysely<DB>({
            dialect: new PostgresDialect({
              pool: new Pool({ connectionString: config.databaseUrl }),
            }),
          }),
      ),
      (db) => Effect.promise(() => db.destroy()),
    );
  }),
);
```

This is exactly the right Patientor pattern because:

- startup reads config through Effect
- Postgres pool creation is centralized
- `db.destroy()` is guaranteed when the layer is released
- tests can replace `Database` with a fake

## Query pattern

Wrap promise-returning Kysely calls with `Effect.tryPromise` and map failures into domain errors:

```ts
const patients =
  yield *
  Effect.tryPromise({
    try: () =>
      db
        .selectFrom("patients")
        .select(["id", "name", "date_of_birth", "gender", "occupation"])
        .orderBy("name")
        .execute(),
    catch: (cause) => new PatientReadError({ cause }),
  });
```

Do not hide Kysely behind a generic repository unless the duplication becomes real. Right now, direct typed queries are clearer.

When duplication does become real, prefer an Effect service boundary over a classic OOP repository. In this repo's installed Effect v4 beta, the shape should be a `Context.Service` plus `Layer`:

```ts
export class PatientRepository extends Context.Service<
  PatientRepository,
  {
    readonly addEntry: (
      patientId: string,
      entry: NewEntryInput,
    ) => Effect.Effect<Patient | undefined, PatientReadError | PatientWriteError>;
  }
>()("PatientRepository") {}
```

`PatientRepositoryLive` should depend on `Database`; tests can provide `PatientRepositoryTest`. That aligns with Effect dependency injection without hiding SQL behind vague abstractions too early.

## Transactions

For Patientor writes that touch multiple tables, put the Kysely transaction inside one `Effect.tryPromise`:

```ts
export class PatientWriteError extends Data.TaggedClass("PatientWriteError")<{
  readonly cause: unknown;
}> {}

const addPatientWithEntries = Effect.fnUntraced(function* (input: NewPatientInput) {
  const db = yield* Database;

  return yield* Effect.tryPromise({
    try: () =>
      db.transaction().execute(async (trx) => {
        const patientId = uuid();

        await trx
          .insertInto("patients")
          .values({
            id: patientId,
            name: input.name,
            date_of_birth: input.dateOfBirth,
            ssn: input.ssn,
            gender: input.gender as Gender,
            occupation: input.occupation,
          })
          .execute();

        return { id: patientId, ...input, entries: [] };
      }),
    catch: (cause) => new PatientWriteError({ cause }),
  });
});
```

The transaction remains a normal Kysely transaction. Effect owns the boundary and typed failure.

## Generated DB types

Do not manually edit `apps/server/src/db/generated.ts`. Change the database schema, then run:

```sh
pnpm --filter server db:types
```

Keep custom JSON column types in `apps/server/src/db/entryTypes.ts` and `apps/server/.kysely-codegenrc.json`.
