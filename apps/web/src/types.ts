import type {
  Diagnosis,
  Entry,
  Gender as ApiGender,
  HealthCheckRating as ApiHealthCheckRating,
  NewPatientInput,
  NonSensitivePatient,
  NonSensitivePatientWithEntries,
  Patient as CreatedPatient,
} from "@patientor/api";

export type { Diagnosis, Entry };

export const Gender = {
  Female: "female",
  Male: "male",
  Other: "other",
} as const satisfies Record<string, ApiGender>;

export type Gender = ApiGender;

export const HealthCheckRating = {
  Healthy: 0,
  LowRisk: 1,
  HighRisk: 2,
  CriticalRisk: 3,
} as const satisfies Record<string, ApiHealthCheckRating>;

export type HealthCheckRating = ApiHealthCheckRating;

export type HospitalEntry = Extract<Entry, { type: "Hospital" }>;

export type OccupationalHealthcareEntry = Extract<Entry, { type: "OccupationalHealthcare" }>;

export type HealthCheckEntry = Extract<Entry, { type: "HealthCheck" }>;

export type Patient = NonSensitivePatient;

export type PatientDetails = NonSensitivePatientWithEntries;

export type PatientFormValues = NewPatientInput;

export type CreatedPatientResponse = CreatedPatient;
