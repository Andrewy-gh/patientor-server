# 07 — Testing

Patientor uses `@effect/vitest`. Keep that. It gives `it.effect`, Effect assertions, and test services without inventing custom runners.

## Plain tests

For pure helpers, simple tests are enough:

```ts
import { assert, test } from "@effect/vitest";

test("validates patient SSN shape", () => {
  const pattern = /^\d{6}-[a-zA-Z0-9]{3,4}$/;

  assert.isTrue(pattern.test("090786-122X"));
  assert.isFalse(pattern.test("abcdef-1234"));
});
```

## Service tests with fake database

Because services depend on `Database`, tests can provide a fake layer:

```ts
import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Database } from "../src/db/database.js";
import { getDiagnoses } from "../src/diagnoses/service.js";

it.effect("returns diagnoses without empty latin fields", () =>
  Effect.gen(function* () {
    const fakeDb = {
      selectFrom: () => ({
        select: () => ({
          orderBy: () => ({
            execute: async () => [
              { code: "A01", name: "Typhoid fever", latin: null },
            ],
          }),
        }),
      }),
    };

    const result = yield* getDiagnoses.pipe(
      Effect.provide(Layer.succeed(Database)(fakeDb as never)),
    );

    assert.deepStrictEqual(result, [
      { code: "A01", name: "Typhoid fever" },
    ]);
  }),
);
```

This is better than booting Postgres for every service test. Use real Postgres only for integration tests.

## Avoid faking third-party fluent APIs repeatedly

A fake `Database` layer is fine for small service or route tests, but do not let each test hand-roll a large mock of Kysely's chained API.

Good use of a fake database:

- tiny query surface
- behavior-focused assertions
- fast coverage for `400`, `404`, and `500` route behavior
- backed by at least one real Postgres integration test for persistence

Bad use of a fake database:

- duplicating long `selectFrom().select().where().execute()` chains across many tests
- asserting implementation trivia like call counts or exact query order
- treating the fake as proof that SQL/Postgres behavior works

If a fake starts mirroring too much Kysely, introduce an Effect service boundary for the app-owned behavior instead. For example, a `PatientRepository` `Context.Service` can expose `addEntry`, `findNonSensitiveById`, etc. `PatientRepositoryLive` can depend on `Database`, while tests provide a small `PatientRepositoryTest` layer.

That keeps tests focused on Patientor behavior instead of maintaining a second, fake Kysely.

## Testing failures

Use `Effect.exit` when you want to assert typed failures:

```ts
import { assert, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import { Database } from "../src/db/database.js";
import { getNonSensitivePatients, PatientReadError } from "../src/patients/service.js";

it.effect("maps database failures to PatientReadError", () =>
  Effect.gen(function* () {
    const fakeDb = {
      selectFrom: () => ({
        select: () => ({
          orderBy: () => ({
            execute: async () => {
              throw new Error("database down");
            },
          }),
        }),
      }),
    };

    const result = yield* Effect.exit(
      getNonSensitivePatients.pipe(
        Effect.provide(Layer.succeed(Database)(fakeDb as never)),
      ),
    );

    assert.isTrue(Exit.isFailure(result));
    if (Exit.isFailure(result)) {
      const failure = result.cause.reasons.find(Cause.isFailReason);
      assert.instanceOf(failure?.error, PatientReadError);
    }
  }),
);
```

If the exact `Cause` shape gets annoying, assert through route behavior instead: fake DB throws, route returns `500`.

## Integration tests

Use integration tests for:

- migrations create expected enum/table shape
- seed script inserts diagnoses/patients/entries
- HTTP route returns non-sensitive patient data
- deleting a patient cascades entries

Do not use integration tests for every mapper. That makes the suite slow and brittle.

## Test naming

Name tests after Patientor behavior, not implementation trivia:

- good: `does not expose ssn in patient list`
- good: `returns 400 for invalid patient id`
- good: `maps missing hospital discharge to internal entry error`
- bad: `calls selectFrom once`
