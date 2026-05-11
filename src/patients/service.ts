import { Effect } from "effect";
import { v1 as uuid } from "uuid";
import { Database } from "../db/database.js";
import { Gender } from "../db/generated.js";
import {
  PatientReadError,
  PatientRepository,
  PatientWriteError,
  toEntry,
} from "./repository.js";
import {
  NewEntryInput,
  NewPatientInput,
} from "./types.js";

export {
  InvalidPatientEntry,
  PatientReadError,
  PatientWriteError,
} from "./repository.js";

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

  const mappedEntries = yield* Effect.all(entries.map(toEntry));

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
    catch: (e) => new PatientWriteError({ cause: e }),
  });
});

export const addPatientEntry = Effect.fnUntraced(function* (
  patientId: string,
  entry: NewEntryInput,
) {
  const patients = yield* PatientRepository;
  return yield* patients.addEntry(patientId, entry);
});
