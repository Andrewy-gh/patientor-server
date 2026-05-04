import { Data, Effect } from "effect";
import { Database } from "../db/database.js";

export class DiagnosisReadError extends Data.TaggedClass("DiagnosisReadError")<{
  readonly cause: unknown;
}> {}

export const getDiagnoses = Effect.gen(function* () {
  const db = yield* Database;

  const diagnoses = yield* Effect.tryPromise({
    try: () =>
      db
        .selectFrom("diagnoses")
        .select(["code", "name", "latin"])
        .orderBy("code")
        .execute(),
    catch: (cause) => new DiagnosisReadError({ cause }),
  });

  return diagnoses.map((diagnosis) => ({
    code: diagnosis.code,
    name: diagnosis.name,
    ...(diagnosis.latin ? { latin: diagnosis.latin } : {}),
  }));
});
