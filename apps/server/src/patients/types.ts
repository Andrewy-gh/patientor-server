import type {
  Entry,
  Gender as ApiGender,
  NewEntryInput,
  NewPatientInput,
  NonSensitivePatient,
  NonSensitivePatientWithEntries,
  Patient,
} from "@patientor/api";
import type { Gender as DatabaseGender } from "../db/generated.js";

type AssertAssignable<Actual extends Expected, Expected> = Actual;

export type GenderApiMatchesDatabase = AssertAssignable<ApiGender, DatabaseGender>;
export type GenderDatabaseMatchesApi = AssertAssignable<DatabaseGender, ApiGender>;

export type {
  Entry,
  ApiGender as Gender,
  NewEntryInput,
  NewPatientInput,
  NonSensitivePatient,
  NonSensitivePatientWithEntries,
  Patient,
};
