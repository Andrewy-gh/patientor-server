import { Context, Data, Effect, Layer } from "effect";
import { Kysely, Selectable } from "kysely";
import { v1 as uuid } from "uuid";
import { Database } from "../db/database.js";
import {
  DB,
  Entries,
  HealthCheckRating as DbHealthCheckRating,
} from "../db/generated.js";
import {
  Entry,
  HealthCheckRating,
  NewEntryInput,
  NonSensitivePatient,
} from "./types.js";

type EntryRow = Selectable<Entries>;

type PatientWithEntries = NonSensitivePatient & {
  readonly entries: Entry[];
};

const healthCheckRatings: Record<DbHealthCheckRating, HealthCheckRating> = {
  Healthy: HealthCheckRating.Healthy,
  LowRisk: HealthCheckRating.LowRisk,
  HighRisk: HealthCheckRating.HighRisk,
  CriticalRisk: HealthCheckRating.CriticalRisk,
};

const dbHealthCheckRatings: Record<HealthCheckRating, DbHealthCheckRating> = {
  [HealthCheckRating.Healthy]: "Healthy",
  [HealthCheckRating.LowRisk]: "LowRisk",
  [HealthCheckRating.HighRisk]: "HighRisk",
  [HealthCheckRating.CriticalRisk]: "CriticalRisk",
};

export class PatientReadError extends Data.TaggedClass("PatientReadError")<{
  readonly cause: unknown;
}> {}

export class PatientWriteError extends Data.TaggedClass("PatientWriteError")<{
  readonly cause: unknown;
}> {}

export class InvalidPatientEntry extends Data.TaggedClass("InvalidPatientEntry")<{
  readonly entryId: string;
  readonly reason: string;
}> {}

export class PatientRepository extends Context.Service<
  PatientRepository,
  {
    readonly addEntry: (
      patientId: string,
      entry: NewEntryInput,
    ) => Effect.Effect<
      PatientWithEntries | undefined,
      PatientWriteError | InvalidPatientEntry
    >;
  }
>()("PatientRepository") {}

const addEntry = Effect.fnUntraced(function* (
  db: Kysely<DB>,
  patientId: string,
  entry: NewEntryInput,
) {
  const entryId = uuid();

  const result = yield* Effect.tryPromise({
    try: () =>
      db.transaction().execute(async (trx) => {
        const patient = await trx
          .selectFrom("patients")
          .select(["id", "name", "date_of_birth", "gender", "occupation"])
          .where("id", "=", patientId)
          .executeTakeFirst();

        if (!patient) {
          return undefined;
        }

        await trx
          .insertInto("entries")
          .values({
            id: entryId,
            patient_id: patientId,
            date: entry.date,
            type: entry.type,
            specialist: entry.specialist,
            description: entry.description,
            diagnosis_codes: entry.diagnosisCodes
              ? [...entry.diagnosisCodes]
              : null,
            health_check_rating:
              entry.type === "HealthCheck"
                ? dbHealthCheckRatings[entry.healthCheckRating]
                : null,
            discharge: entry.type === "Hospital" ? entry.discharge : null,
            employer_name:
              entry.type === "OccupationalHealthcare"
                ? entry.employerName
                : null,
            sick_leave:
              entry.type === "OccupationalHealthcare"
                ? entry.sickLeave ?? null
                : null,
          })
          .execute();

        const entries = await trx
          .selectFrom("entries")
          .selectAll()
          .where("patient_id", "=", patientId)
          .orderBy("date")
          .execute();

        return { patient, entries };
      }),
    catch: (cause) => new PatientWriteError({ cause }),
  });

  if (!result) {
    return undefined;
  }

  const mappedEntries = yield* Effect.all(result.entries.map(toEntry));

  return {
    id: result.patient.id,
    name: result.patient.name,
    dateOfBirth: result.patient.date_of_birth,
    gender: result.patient.gender,
    occupation: result.patient.occupation,
    entries: mappedEntries,
  };
});

export const PatientRepositoryLive = Layer.effect(
  PatientRepository,
  Effect.gen(function* () {
    const db = yield* Database;

    return {
      addEntry: (patientId: string, entry: NewEntryInput) =>
        addEntry(db, patientId, entry),
    };
  }),
);

export const toEntry = (
  entry: EntryRow,
): Effect.Effect<Entry, InvalidPatientEntry> => {
  const baseEntry = {
    id: entry.id,
    date: entry.date,
    specialist: entry.specialist,
    description: entry.description,
    ...(entry.diagnosis_codes ? { diagnosisCodes: entry.diagnosis_codes } : {}),
  };

  switch (entry.type) {
    case "HealthCheck":
      return Effect.succeed({
        ...baseEntry,
        type: "HealthCheck",
        healthCheckRating: entry.health_check_rating
          ? healthCheckRatings[entry.health_check_rating]
          : HealthCheckRating.Healthy,
      } satisfies Entry);
    case "Hospital":
      if (!entry.discharge) {
        return Effect.fail(
          new InvalidPatientEntry({
            entryId: entry.id,
            reason: "Hospital entry is missing discharge data",
          }),
        );
      }

      return Effect.succeed({
        ...baseEntry,
        type: "Hospital",
        discharge: entry.discharge,
      } satisfies Entry);
    case "OccupationalHealthcare":
      if (!entry.employer_name) {
        return Effect.fail(
          new InvalidPatientEntry({
            entryId: entry.id,
            reason: "Occupational healthcare entry is missing employer name",
          }),
        );
      }

      return Effect.succeed({
        ...baseEntry,
        type: "OccupationalHealthcare",
        employerName: entry.employer_name,
        ...(entry.sick_leave ? { sickLeave: entry.sick_leave } : {}),
      } satisfies Entry);
    default:
      return Effect.fail(
        new InvalidPatientEntry({
          entryId: entry.id,
          reason: `Unknown entry type: ${entry.type}`,
        }),
      );
  }
};
