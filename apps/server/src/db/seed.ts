import type { HealthCheckRating as ApiHealthCheckRating } from "@patientor/api";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer } from "effect";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import { diagnoses } from "../../data/diagnoses.ts";
import patients from "../../data/patients.ts";
import { AppLive } from "../layers.ts";
import { Database } from "./database.ts";
import type { DB, Gender, HealthCheckRating } from "./generated.ts";

const healthCheckRatings: Record<ApiHealthCheckRating, HealthCheckRating> = {
  0: "Healthy",
  1: "LowRisk",
  2: "HighRisk",
  3: "CriticalRisk",
};

const insertSeedData = (db: Kysely<DB>) =>
  Effect.promise(async () => {
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("entries").execute();
      await trx.deleteFrom("patients").execute();
      await trx.deleteFrom("diagnoses").execute();

      if (diagnoses.length > 0) {
        await trx
          .insertInto("diagnoses")
          .values(
            diagnoses.map((diagnosis) => ({
              code: diagnosis.code,
              name: diagnosis.name,
              latin: diagnosis.latin ?? null,
            })),
          )
          .execute();
      }

      if (patients.length > 0) {
        await trx
          .insertInto("patients")
          .values(
            patients.map((patient) => ({
              id: patient.id,
              name: patient.name,
              date_of_birth: patient.dateOfBirth,
              ssn: patient.ssn,
              gender: patient.gender as Gender,
              occupation: patient.occupation,
            })),
          )
          .execute();
      }

      const entries = patients.flatMap((patient) =>
        (patient.entries ?? []).map((entry) => ({
          id: entry.id,
          patient_id: patient.id,
          date: entry.date,
          type: entry.type,
          specialist: entry.specialist,
          description: entry.description,
          diagnosis_codes: entry.diagnosisCodes
            ? sql<string[]>`ARRAY[${sql.join(entry.diagnosisCodes)}]::text[]`
            : null,
          health_check_rating:
            entry.type === "HealthCheck" ? healthCheckRatings[entry.healthCheckRating] : null,
          discharge: entry.type === "Hospital" ? entry.discharge : null,
          employer_name: entry.type === "OccupationalHealthcare" ? entry.employerName : null,
          sick_leave: entry.type === "OccupationalHealthcare" ? (entry.sickLeave ?? null) : null,
        })),
      );

      if (entries.length > 0) {
        await trx.insertInto("entries").values(entries).execute();
      }
    });
  });

const seed = Effect.gen(function* () {
  const db = yield* Database;

  yield* insertSeedData(db);
  yield* Effect.log("Database seeded");
});

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), {
  asPrimary: true,
});

const MainLive = AppLive.pipe(Layer.provide(DotEnvLive), Layer.provide(NodeServices.layer));

seed.pipe(Effect.provide(MainLive), NodeRuntime.runMain);
