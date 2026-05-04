import { Selectable } from "kysely";
import { Database } from "../db/database.js";
import {
  Entries,
  Gender,
  HealthCheckRating as DbHealthCheckRating,
} from "../db/generated.js";
import { Entry, HealthCheckRating, NewPatientInput } from "../types.js";
import { v1 as uuid } from "uuid";
import { Data, Effect } from "effect";

type EntryRow = Selectable<Entries>;

const healthCheckRatings: Record<DbHealthCheckRating, HealthCheckRating> = {
  Healthy: HealthCheckRating.Healthy,
  LowRisk: HealthCheckRating.LowRisk,
  HighRisk: HealthCheckRating.HighRisk,
  CriticalRisk: HealthCheckRating.CriticalRisk,
};

export class PatientReadError extends Data.TaggedClass("PatientReadError")<{
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

export const getNonSensitivePatient = (id: string) =>
  Effect.gen(function* () {
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

export const addNewPatient = (patient: NewPatientInput) =>
  Effect.gen(function* () {
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
