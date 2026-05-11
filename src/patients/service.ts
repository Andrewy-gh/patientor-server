import { Data, Effect } from "effect";
import { Selectable } from "kysely";
import { v1 as uuid } from "uuid";
import { Database } from "../db/database.js";
import {
  Entries,
  Gender,
  HealthCheckRating as DbHealthCheckRating,
} from "../db/generated.js";
import {
  Entry,
  HealthCheckRating,
  NewEntryInput,
  NewPatientInput,
} from "./types.js";

type EntryRow = Selectable<Entries>;

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

export const getNonSensitivePatients = Effect.gen(function* () {
  const db = yield* Database;

  const patients = yield* Effect.tryPromise({
    try: () =>
      db
        .selectFrom("patients")
        .select(["id", "name", "date_of_birth", "gender", "occupation"])
        .orderBy("name")
        .execute(),
    catch: (e) => new PatientReadError({ cause: e }),
  });
  return patients.map(({ id, name, date_of_birth, gender, occupation }) => ({
    id,
    name,
    dateOfBirth: date_of_birth,
    gender,
    occupation,
  }));
});

export const getNonSensitivePatient = Effect.fnUntraced(function* (id: string) {
  const db = yield* Database;

  const patient = yield* Effect.tryPromise({
    try: () =>
      db
        .selectFrom("patients")
        .select(["id", "name", "date_of_birth", "gender", "occupation"])
        .where("id", "=", id)
        .executeTakeFirst(),
    catch: (e) => new PatientReadError({ cause: e }),
  });

  if (!patient) {
    return undefined;
  }

  const entries = yield* Effect.tryPromise({
    try: () =>
      db
        .selectFrom("entries")
        .selectAll()
        .where("patient_id", "=", id)
        .orderBy("date")
        .execute(),
    catch: (e) => new PatientReadError({ cause: e }),
  });

  const mappedEntries = yield* Effect.try({
    try: () => entries.map(toEntry),
    catch: (e) => new PatientReadError({ cause: e }),
  });

  return {
    id: patient.id,
    name: patient.name,
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender,
    occupation: patient.occupation,
    entries: mappedEntries,
  };
});

export const addNewPatient = Effect.fnUntraced(function* (
  patient: NewPatientInput,
) {
  const newPatient = {
    id: uuid(),
    ...patient,
    entries: [],
  };
  const db = yield* Database;

  return yield* Effect.tryPromise({
    try: async () => {
      await db
        .insertInto("patients")
        .values({
          id: newPatient.id,
          name: newPatient.name,
          date_of_birth: newPatient.dateOfBirth,
          ssn: newPatient.ssn,
          gender: newPatient.gender as Gender,
          occupation: newPatient.occupation,
        })
        .execute();

      return newPatient;
    },
    catch: (e) => new PatientReadError({ cause: e }),
  });
});

export const addPatientEntry = Effect.fnUntraced(function* (
  patientId: string,
  entry: NewEntryInput,
) {
  const db = yield* Database;
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
    catch: (e) => new PatientWriteError({ cause: e }),
  });

  if (!result) {
    return undefined;
  }

  const mappedEntries = yield* Effect.try({
    try: () => result.entries.map(toEntry),
    catch: (e) => new PatientReadError({ cause: e }),
  });

  return {
    id: result.patient.id,
    name: result.patient.name,
    dateOfBirth: result.patient.date_of_birth,
    gender: result.patient.gender,
    occupation: result.patient.occupation,
    entries: mappedEntries,
  };
});

const toEntry = (entry: EntryRow): Entry => {
  const baseEntry = {
    id: entry.id,
    date: entry.date,
    specialist: entry.specialist,
    description: entry.description,
    ...(entry.diagnosis_codes ? { diagnosisCodes: entry.diagnosis_codes } : {}),
  };

  switch (entry.type) {
    case "HealthCheck":
      return {
        ...baseEntry,
        type: "HealthCheck",
        healthCheckRating: entry.health_check_rating
          ? healthCheckRatings[entry.health_check_rating]
          : HealthCheckRating.Healthy,
      };
    case "Hospital":
      if (!entry.discharge) {
        throw new Error(`Hospital entry ${entry.id} is missing discharge data`);
      }

      return {
        ...baseEntry,
        type: "Hospital",
        discharge: entry.discharge,
      };
    case "OccupationalHealthcare":
      if (!entry.employer_name) {
        throw new Error(
          `OccupationalHealthcare entry ${entry.id} is missing employer name`,
        );
      }

      return {
        ...baseEntry,
        type: "OccupationalHealthcare",
        employerName: entry.employer_name,
        ...(entry.sick_leave ? { sickLeave: entry.sick_leave } : {}),
      };
    default:
      throw new Error(`Unknown entry type: ${entry.type}`);
  }
};
