import { Schema } from "effect";

export const Diagnosis = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  latin: Schema.optionalKey(Schema.String),
});

export type Diagnosis = typeof Diagnosis.Type;
