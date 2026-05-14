# 04 — Domain Errors

Patientor handles medical-ish data, so failures need to be explicit and boring. A route should know whether it is returning `400`, `404`, `409`, or `500` without parsing thrown strings.

## Use tagged errors for expected failures

Current pattern:

```ts
import { Data } from "effect";

export class PatientReadError extends Data.TaggedClass("PatientReadError")<{
  readonly cause: unknown;
}> {}
```

Recommended split:

```ts
export class PatientReadError extends Data.TaggedClass("PatientReadError")<{
  readonly cause: unknown;
}> {}

export class PatientWriteError extends Data.TaggedClass("PatientWriteError")<{
  readonly cause: unknown;
}> {}

export class PatientNotFound extends Data.TaggedClass("PatientNotFound")<{
  readonly id: string;
}> {}

export class InvalidPatientEntry extends Data.TaggedClass("InvalidPatientEntry")<{
  readonly entryId: string;
  readonly reason: string;
}> {}
```

## Avoid throwing inside domain mapping

Current `toEntry` throws if a DB row is internally inconsistent. That is fine for a first pass, but a safer Effect-aligned version returns a typed failure:

```ts
const toEntryEffect = (entry: EntryRow) => {
  const baseEntry = {
    id: entry.id,
    date: entry.date,
    specialist: entry.specialist,
    description: entry.description,
    ...(entry.diagnosis_codes ? { diagnosisCodes: entry.diagnosis_codes } : {}),
  };

  switch (entry.type) {
    case "Hospital":
      return entry.discharge
        ? Effect.succeed({ ...baseEntry, type: "Hospital" as const, discharge: entry.discharge })
        : Effect.fail(
            new InvalidPatientEntry({
              entryId: entry.id,
              reason: "Hospital entry is missing discharge data",
            }),
          );

    case "OccupationalHealthcare":
      return entry.employer_name
        ? Effect.succeed({
            ...baseEntry,
            type: "OccupationalHealthcare" as const,
            employerName: entry.employer_name,
            ...(entry.sick_leave ? { sickLeave: entry.sick_leave } : {}),
          })
        : Effect.fail(
            new InvalidPatientEntry({
              entryId: entry.id,
              reason: "Occupational healthcare entry is missing employer name",
            }),
          );

    case "HealthCheck":
      return Effect.succeed({
        ...baseEntry,
        type: "HealthCheck" as const,
        healthCheckRating: entry.health_check_rating
          ? healthCheckRatings[entry.health_check_rating]
          : HealthCheckRating.Healthy,
      });
  }
};
```

Then map many rows with `Effect.forEach`:

```ts
const mappedEntries = yield * Effect.forEach(entries, toEntryEffect);
```

## Route mapping

Handle errors by tag, closest to the route:

```ts
program.pipe(
  Effect.catchTag("PatientNotFound", () =>
    Effect.succeed(HttpServerResponse.empty({ status: 404 })),
  ),
  Effect.catchTag("InvalidPatientEntry", (error) =>
    Effect.gen(function* () {
      yield* Effect.logError(error);
      return HttpServerResponse.empty({ status: 500 });
    }),
  ),
  Effect.catchTag("PatientReadError", (error) =>
    Effect.gen(function* () {
      yield* Effect.logError(error);
      return HttpServerResponse.empty({ status: 500 });
    }),
  ),
);
```

## Naming rule

Name errors after the operation and domain outcome, not the library:

- good: `PatientReadError`, `PatientWriteError`, `PatientNotFound`
- bad: `KyselyError`, `PostgresError`, `UnknownError`
