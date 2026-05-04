import { sql } from 'kysely';
import { diagnoses } from "../../data/diagnoses.js";
import patients from "../../data/patients.js";
import { db } from "./database.js";
import { Gender, HealthCheckRating } from "./generated.js";
import { HealthCheckRating as ApiHealthCheckRating } from "../types.js";

const healthCheckRatings: Record<ApiHealthCheckRating, HealthCheckRating> = {
  [ApiHealthCheckRating.Healthy]: 'Healthy',
  [ApiHealthCheckRating.LowRisk]: 'LowRisk',
  [ApiHealthCheckRating.HighRisk]: 'HighRisk',
  [ApiHealthCheckRating.CriticalRisk]: 'CriticalRisk',
};

const seed = async () => {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('entries').execute();
    await trx.deleteFrom('patients').execute();
    await trx.deleteFrom('diagnoses').execute();

    if (diagnoses.length > 0) {
      await trx
        .insertInto('diagnoses')
        .values(
          diagnoses.map((diagnosis) => ({
            code: diagnosis.code,
            name: diagnosis.name,
            latin: diagnosis.latin ?? null,
          }))
        )
        .execute();
    }

    if (patients.length > 0) {
      await trx
        .insertInto('patients')
        .values(
          patients.map((patient) => ({
            id: patient.id,
            name: patient.name,
            date_of_birth: patient.dateOfBirth,
            ssn: patient.ssn,
            gender: patient.gender as Gender,
            occupation: patient.occupation,
          }))
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
          entry.type === 'HealthCheck'
            ? healthCheckRatings[entry.healthCheckRating]
            : null,
        discharge: entry.type === 'Hospital' ? entry.discharge : null,
        employer_name:
          entry.type === 'OccupationalHealthcare' ? entry.employerName : null,
        sick_leave:
          entry.type === 'OccupationalHealthcare' ? entry.sickLeave ?? null : null,
      }))
    );

    if (entries.length > 0) {
      await trx.insertInto('entries').values(entries).execute();
    }
  });
};

seed()
  .then(async () => {
    console.log('Database seeded');
    await db.destroy();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await db.destroy();
    process.exit(1);
  });
