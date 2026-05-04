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
