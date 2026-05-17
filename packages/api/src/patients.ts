import { Schema } from "effect";
import { HttpApiSchema } from "effect/unstable/httpapi";

const isValidDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const DateOnly = Schema.String.check(
  Schema.makeFilter<string>(
    (value) => isValidDateOnly(value) || "Expected a valid date in YYYY-MM-DD format",
  ),
);

export const GenderValues = ["female", "male", "other"] as const;

export const Gender = Schema.Literals(GenderValues);

export type Gender = typeof Gender.Type;

export const HealthCheckRatingValues = [0, 1, 2, 3] as const;

export const HealthCheckRating = Schema.Literals(HealthCheckRatingValues);

export type HealthCheckRating = typeof HealthCheckRating.Type;

const BaseEntry = {
  id: Schema.String,
  description: Schema.String,
  date: Schema.String,
  specialist: Schema.String,
  diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
};

export const Entry = Schema.Union([
  Schema.Struct({
    ...BaseEntry,
    type: Schema.Literal("HealthCheck"),
    healthCheckRating: HealthCheckRating,
  }),
  Schema.Struct({
    ...BaseEntry,
    type: Schema.Literal("Hospital"),
    discharge: Schema.Struct({
      date: Schema.String,
      criteria: Schema.String,
    }),
  }),
  Schema.Struct({
    ...BaseEntry,
    type: Schema.Literal("OccupationalHealthcare"),
    employerName: Schema.String,
    sickLeave: Schema.optionalKey(
      Schema.Struct({
        startDate: Schema.String,
        endDate: Schema.String,
      }),
    ),
  }),
]);

export type Entry = typeof Entry.Type;

export const Patient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  ssn: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.optionalKey(Schema.Array(Entry)),
});

export type Patient = typeof Patient.Type;

export const NonSensitivePatient = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
});

export type NonSensitivePatient = typeof NonSensitivePatient.Type;

export const NonSensitivePatientWithEntries = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dateOfBirth: Schema.String,
  gender: Gender,
  occupation: Schema.String,
  entries: Schema.Array(Entry),
});

export type NonSensitivePatientWithEntries = typeof NonSensitivePatientWithEntries.Type;

export const CreatedPatient = Patient.pipe(HttpApiSchema.status("Created"));

const Ssn = Schema.String.check(Schema.isPattern(/^\d{6}-[A-Za-z0-9]{3,4}$/));

export const NewPatientInput = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  dateOfBirth: DateOnly,
  ssn: Ssn,
  gender: Gender,
  occupation: Schema.String.check(Schema.isMinLength(1)),
});

export type NewPatientInput = typeof NewPatientInput.Type;

export const PatientIdParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
});

export type PatientIdParams = typeof PatientIdParams.Type;

const BaseEntryInput = {
  description: Schema.String.check(Schema.isMinLength(1)),
  date: DateOnly,
  specialist: Schema.String.check(Schema.isMinLength(1)),
  diagnosisCodes: Schema.optionalKey(Schema.Array(Schema.String)),
};

export const NewEntryInput = Schema.Union([
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("HealthCheck"),
    healthCheckRating: HealthCheckRating,
  }),
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("Hospital"),
    discharge: Schema.Struct({
      date: DateOnly,
      criteria: Schema.String.check(Schema.isMinLength(1)),
    }),
  }),
  Schema.Struct({
    ...BaseEntryInput,
    type: Schema.Literal("OccupationalHealthcare"),
    employerName: Schema.String.check(Schema.isMinLength(1)),
    sickLeave: Schema.optionalKey(
      Schema.Struct({
        startDate: DateOnly,
        endDate: DateOnly,
      }),
    ),
  }),
]);

export type NewEntryInput = typeof NewEntryInput.Type;

export const UpdatedPatient = NonSensitivePatientWithEntries.pipe(HttpApiSchema.status("Created"));
