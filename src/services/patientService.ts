import { Selectable } from "kysely";
import { db } from "../db/database.js";
import { Entries, Gender, HealthCheckRating as DbHealthCheckRating } from "../db/generated.js";
import {
  Entry,
  HealthCheckRating,
  NewPatient,
} from "../types.js";
import { v1 as uuid } from "uuid";

type EntryRow = Selectable<Entries>;

const healthCheckRatings: Record<DbHealthCheckRating, HealthCheckRating> = {
  Healthy: HealthCheckRating.Healthy,
  LowRisk: HealthCheckRating.LowRisk,
  HighRisk: HealthCheckRating.HighRisk,
  CriticalRisk: HealthCheckRating.CriticalRisk,
};

const getNonSensitivePatients = async () => {
  const patients = await db
    .selectFrom("patients")
    .select(["id", "name", "date_of_birth", "gender", "occupation"])
    .orderBy("name")
    .execute();

  return patients.map(({ id, name, date_of_birth, gender, occupation }) => ({
    id,
    name,
    dateOfBirth: date_of_birth,
    gender,
    occupation,
  }));
};

const getNonSensitivePatient = async (id: string) => {
  const patient = await db
    .selectFrom("patients")
    .select(["id", "name", "date_of_birth", "ssn", "gender", "occupation"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!patient) {
    return undefined;
  }

  const entries = await db
    .selectFrom("entries")
    .selectAll()
    .where("patient_id", "=", id)
    .orderBy("date")
    .execute();

  return {
    id: patient.id,
    name: patient.name,
    dateOfBirth: patient.date_of_birth,
    ssn: patient.ssn,
    gender: patient.gender,
    occupation: patient.occupation,
    entries: entries.map(toEntry),
  };
};

const addNewPatient = async (patient: NewPatient) => {
  const newPatient = {
    id: uuid(),
    ...patient,
    entries: [],
  };

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
};

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
        healthCheckRating:
          entry.health_check_rating
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

export default {
  getNonSensitivePatients,
  getNonSensitivePatient,
  addNewPatient,
};
