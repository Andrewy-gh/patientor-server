import { NodeHttpServer } from "@effect/platform-node";
import { assert, beforeAll, describe, it } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpRouter,
} from "effect/unstable/http";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { AppConfigService } from "../src/config.js";
import { DatabaseLive } from "../src/db/database.js";
import { DB } from "../src/db/generated.js";
import { HttpRoutes } from "../src/http/routes.js";
import { PatientRepositoryLive } from "../src/patients/repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

const patientId = "33333333-3333-4333-8333-333333333333";
const encoder = new TextEncoder();

const makeDb = () =>
  new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl }),
    }),
  });

const migrate = (db: Kysely<DB>) =>
  Effect.promise(async () => {
    await sql`
      DO $$
      BEGIN
        CREATE TYPE gender AS ENUM ('male', 'female', 'other');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `.execute(db);

    await sql`
      DO $$
      BEGIN
        CREATE TYPE entry_type AS ENUM (
          'Hospital',
          'OccupationalHealthcare',
          'HealthCheck'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `.execute(db);

    await sql`
      DO $$
      BEGIN
        CREATE TYPE health_check_rating AS ENUM (
          'Healthy',
          'LowRisk',
          'HighRisk',
          'CriticalRisk'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `.execute(db);

    await db.schema
      .createTable("patients")
      .ifNotExists()
      .addColumn("id", "uuid", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("date_of_birth", "date", (column) => column.notNull())
      .addColumn("ssn", "text", (column) => column.notNull())
      .addColumn("gender", sql`gender`, (column) => column.notNull())
      .addColumn("occupation", "text", (column) => column.notNull())
      .addColumn("created_at", "timestamp", (column) =>
        column.notNull().defaultTo(sql`now()`),
      )
      .execute();

    await db.schema
      .createTable("entries")
      .ifNotExists()
      .addColumn("row_id", "serial", (column) => column.primaryKey())
      .addColumn("id", "uuid", (column) => column.notNull())
      .addColumn("patient_id", "uuid", (column) =>
        column.notNull().references("patients.id").onDelete("cascade"),
      )
      .addColumn("date", "date", (column) => column.notNull())
      .addColumn("type", sql`entry_type`, (column) => column.notNull())
      .addColumn("specialist", "text", (column) => column.notNull())
      .addColumn("description", "text", (column) => column.notNull())
      .addColumn("diagnosis_codes", sql`text[]`)
      .addColumn("health_check_rating", sql`health_check_rating`)
      .addColumn("discharge", "jsonb")
      .addColumn("employer_name", "text")
      .addColumn("sick_leave", "jsonb")
      .execute();
  });

const resetDb = (db: Kysely<DB>) =>
  Effect.promise(async () => {
    await sql`TRUNCATE TABLE entries, patients RESTART IDENTITY CASCADE`.execute(
      db,
    );
    await db
      .insertInto("patients")
      .values({
        id: patientId,
        name: "Live DB Patient",
        date_of_birth: "1990-01-01",
        ssn: "090786-122X",
        gender: "other",
        occupation: "Integration Tester",
      })
      .execute();
  });

const AppConfigTest = Layer.succeed(AppConfigService)({
  port: 0,
  databaseUrl: databaseUrl ?? "",
  nodeEnv: "test",
});

const ServerLive = HttpRouter.serve(HttpRoutes).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provide(PatientRepositoryLive.pipe(Layer.provideMerge(DatabaseLive))),
  Layer.provide(AppConfigTest),
);

const postEntry = (body: unknown) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.post(
      `/api/patients/${patientId}/entries`,
    ).pipe(
      HttpClientRequest.bodyStream(
        Stream.make(encoder.encode(JSON.stringify(body))),
        { contentType: "application/json" },
      ),
    );

    return yield* client.execute(request);
  });

describeIfDb("POST /api/patients/:id/entries with live database", () => {
  beforeAll(async () => {
    const db = makeDb();
    await Effect.runPromise(migrate(db));
    await Effect.runPromise(resetDb(db));
    await db.destroy();
  });

  it.effect("persists supported entry types and returns non-sensitive patient detail", () =>
    Effect.gen(function* () {
      const healthCheck = yield* postEntry({
        type: "HealthCheck",
        description: "Annual check",
        date: "2026-05-11",
        specialist: "Dr Test",
        diagnosisCodes: ["Z57.1"],
        healthCheckRating: 2,
      }).pipe(Effect.provide(ServerLive));

      const hospital = yield* postEntry({
        type: "Hospital",
        description: "Admission",
        date: "2026-05-12",
        specialist: "Dr Ward",
        discharge: { date: "2026-05-13", criteria: "Recovered" },
      }).pipe(Effect.provide(ServerLive));

      const occupational = yield* postEntry({
        type: "OccupationalHealthcare",
        description: "Workplace check",
        date: "2026-05-14",
        specialist: "Dr Work",
        employerName: "ACME",
        sickLeave: { startDate: "2026-05-14", endDate: "2026-05-16" },
      }).pipe(Effect.provide(ServerLive));
      const body = (yield* occupational.json) as Record<string, unknown> & {
        entries: Array<Record<string, unknown>>;
      };

      const persisted = yield* Effect.acquireUseRelease(
        Effect.sync(makeDb),
        (db) =>
          Effect.promise(() =>
            db
              .selectFrom("entries")
              .select([
                "type",
                "health_check_rating",
                "discharge",
                "employer_name",
                "sick_leave",
              ])
              .where("patient_id", "=", patientId)
              .orderBy("date")
              .execute(),
          ),
        (db) => Effect.promise(() => db.destroy()),
      );

      assert.strictEqual(healthCheck.status, 201);
      assert.strictEqual(hospital.status, 201);
      assert.strictEqual(occupational.status, 201);
      assert.notProperty(body, "ssn");
      assert.strictEqual(body.entries.length, 3);
      assert.deepEqual(
        persisted.map((entry) => entry.type),
        ["HealthCheck", "Hospital", "OccupationalHealthcare"],
      );
      assert.strictEqual(persisted[0]?.health_check_rating, "HighRisk");
      assert.deepEqual(persisted[1]?.discharge, {
        date: "2026-05-13",
        criteria: "Recovered",
      });
      assert.strictEqual(persisted[2]?.employer_name, "ACME");
      assert.deepEqual(persisted[2]?.sick_leave, {
        startDate: "2026-05-14",
        endDate: "2026-05-16",
      });
    }),
  );
});
