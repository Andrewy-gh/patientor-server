import { NodeHttpServer } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpRouter,
} from "effect/unstable/http";
import { Database } from "../src/db/database.js";
import { HttpRoutes } from "../src/http/routes.js";

const patientId = "11111111-1111-4111-8111-111111111111";
const missingPatientId = "22222222-2222-4222-8222-222222222222";

type PatientRow = {
  id: string;
  name: string;
  date_of_birth: string;
  gender: "male" | "female" | "other";
  occupation: string;
};

type EntryRow = {
  id: string;
  patient_id: string;
  date: string;
  type: "HealthCheck" | "Hospital" | "OccupationalHealthcare";
  specialist: string;
  description: string;
  diagnosis_codes: string[] | null;
  health_check_rating: "Healthy" | "LowRisk" | "HighRisk" | "CriticalRisk" | null;
  discharge: { date: string; criteria: string } | null;
  employer_name: string | null;
  sick_leave: { startDate: string; endDate: string } | null;
};

const patient: PatientRow = {
  id: patientId,
  name: "Test Patient",
  date_of_birth: "1990-01-01",
  gender: "other",
  occupation: "Tester",
};

const makeDb = (patients: PatientRow[] = [patient]) => {
  const entries: EntryRow[] = [];

  const db = {
    transaction: () => ({
      execute: async <A>(callback: (trx: typeof db) => Promise<A>) => callback(db),
    }),
    selectFrom: (table: "patients" | "entries") => ({
      select: () => ({
        where: (_column: string, _operator: string, id: string) => ({
          executeTakeFirst: () =>
            Promise.resolve(
              table === "patients"
                ? patients.find((candidate) => candidate.id === id)
                : undefined,
            ),
        }),
      }),
      selectAll: () => ({
        where: (_column: string, _operator: string, id: string) => ({
          orderBy: () => ({
            execute: () =>
              Promise.resolve(
                table === "entries"
                  ? entries.filter((entry) => entry.patient_id === id)
                  : [],
              ),
          }),
        }),
      }),
    }),
    insertInto: (table: "entries") => ({
      values: (entry: EntryRow) => ({
        execute: () => {
          if (table === "entries") {
            entries.push(entry);
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  return db;
};

const withServer = (db: ReturnType<typeof makeDb>) =>
  HttpRouter.serve(HttpRoutes).pipe(
    Layer.provideMerge(NodeHttpServer.layerTest),
    Layer.provide(Layer.succeed(Database)(db as never)),
  );

const encoder = new TextEncoder();

const postBody = (id: string, body: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.post(`/api/patients/${id}/entries`).pipe(
      HttpClientRequest.bodyStream(
        Stream.make(encoder.encode(body)),
        { contentType: "application/json" },
      ),
    );
    return yield* client.execute(request);
  });

const postEntry = (id: string, body: unknown) => postBody(id, JSON.stringify(body));

const postMalformedEntry = (id: string) => postBody(id, "{");

describe("POST /api/patients/:id/entries", () => {
  it.effect("returns 400 for invalid patient id", () =>
    Effect.gen(function* () {
      const response = yield* postEntry("not-a-uuid", {
        type: "HealthCheck",
        description: "Fine",
        date: "2026-05-11",
        specialist: "Dr Test",
        healthCheckRating: 0,
      }).pipe(Effect.provide(withServer(makeDb())));

      assert.strictEqual(response.status, 400);
    }),
  );

  it.effect("returns 400 for malformed JSON", () =>
    Effect.gen(function* () {
      const response = yield* postMalformedEntry(patientId).pipe(
        Effect.provide(withServer(makeDb())),
      );

      assert.strictEqual(response.status, 400);
    }),
  );

  it.effect("returns 400 for schema-invalid body", () =>
    Effect.gen(function* () {
      const response = yield* postEntry(patientId, {
        type: "HealthCheck",
        description: "Fine",
        date: "2026-05-11",
        specialist: "Dr Test",
        healthCheckRating: 9,
      }).pipe(Effect.provide(withServer(makeDb())));

      assert.strictEqual(response.status, 400);
    }),
  );

  it.effect("returns 404 for missing patient", () =>
    Effect.gen(function* () {
      const response = yield* postEntry(missingPatientId, {
        type: "HealthCheck",
        description: "Fine",
        date: "2026-05-11",
        specialist: "Dr Test",
        healthCheckRating: 0,
      }).pipe(Effect.provide(withServer(makeDb())));

      assert.strictEqual(response.status, 404);
    }),
  );

  it.effect("inserts and returns updated patient for HealthCheck entries", () =>
    Effect.gen(function* () {
      const response = yield* postEntry(patientId, {
        type: "HealthCheck",
        description: "Annual check",
        date: "2026-05-11",
        specialist: "Dr Test",
        healthCheckRating: 1,
      }).pipe(Effect.provide(withServer(makeDb())));
      const body = (yield* response.json) as Record<string, unknown> & {
        entries: Array<Record<string, unknown>>;
      };

      assert.strictEqual(response.status, 201);
      assert.notProperty(body, "ssn");
      assert.include(body.entries[0], {
        type: "HealthCheck",
        description: "Annual check",
        date: "2026-05-11",
        specialist: "Dr Test",
        healthCheckRating: 1,
      });
    }),
  );

  it.effect("inserts and returns updated patient for Hospital entries", () =>
    Effect.gen(function* () {
      const discharge = { date: "2026-05-12", criteria: "Recovered" };
      const response = yield* postEntry(patientId, {
        type: "Hospital",
        description: "Admission",
        date: "2026-05-11",
        specialist: "Dr Ward",
        discharge,
      }).pipe(Effect.provide(withServer(makeDb())));
      const body = (yield* response.json) as Record<string, unknown> & {
        entries: Array<Record<string, unknown>>;
      };

      assert.strictEqual(response.status, 201);
      assert.notProperty(body, "ssn");
      assert.include(body.entries[0], {
        type: "Hospital",
        description: "Admission",
        date: "2026-05-11",
        specialist: "Dr Ward",
      });
      assert.deepEqual(body.entries[0]?.discharge, discharge);
    }),
  );

  it.effect(
    "inserts and returns updated patient for OccupationalHealthcare entries",
    () =>
      Effect.gen(function* () {
        const sickLeave = { startDate: "2026-05-11", endDate: "2026-05-13" };
        const response = yield* postEntry(patientId, {
          type: "OccupationalHealthcare",
          description: "Workplace check",
          date: "2026-05-11",
          specialist: "Dr Work",
          employerName: "ACME",
          sickLeave,
        }).pipe(Effect.provide(withServer(makeDb())));
        const body = (yield* response.json) as Record<string, unknown> & {
          entries: Array<Record<string, unknown>>;
        };

        assert.strictEqual(response.status, 201);
        assert.notProperty(body, "ssn");
        assert.include(body.entries[0], {
          type: "OccupationalHealthcare",
          description: "Workplace check",
          date: "2026-05-11",
          specialist: "Dr Work",
          employerName: "ACME",
        });
        assert.deepEqual(body.entries[0]?.sickLeave, sickLeave);
      }),
  );
});
