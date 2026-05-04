import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer } from "effect";
import { Kysely, sql } from "kysely";
import { AppLive } from "../layers.js";
import { Database } from "./database.js";
import { DB } from "./generated.js";

const createEnumTypes = (db: Kysely<DB>) =>
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
  });

const createTables = (db: Kysely<DB>) =>
  Effect.promise(async () => {
    await db.schema
    .createTable('diagnoses')
    .ifNotExists()
    .addColumn('code', 'varchar(16)', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('latin', 'text')
    .execute();

    await db.schema
    .createTable('patients')
    .ifNotExists()
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('date_of_birth', 'date', (column) => column.notNull())
    .addColumn('ssn', 'text', (column) => column.notNull())
    .addColumn('gender', sql`gender`, (column) => column.notNull())
    .addColumn('occupation', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamp', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .execute();

    await db.schema
    .createTable('entries')
    .ifNotExists()
    .addColumn('row_id', 'serial', (column) => column.primaryKey())
    .addColumn('id', 'uuid', (column) => column.notNull())
    .addColumn('patient_id', 'uuid', (column) =>
      column.notNull().references('patients.id').onDelete('cascade')
    )
    .addColumn('date', 'date', (column) => column.notNull())
    .addColumn('type', sql`entry_type`, (column) => column.notNull())
    .addColumn('specialist', 'text', (column) => column.notNull())
    .addColumn('description', 'text', (column) => column.notNull())
    .addColumn('diagnosis_codes', sql`text[]`)
    .addColumn('health_check_rating', sql`health_check_rating`)
    .addColumn('discharge', 'jsonb')
    .addColumn('employer_name', 'text')
    .addColumn('sick_leave', 'jsonb')
    .execute();
  });

const migrate = Effect.gen(function* () {
  const db = yield* Database;

  yield* createEnumTypes(db);
  yield* createTables(db);
  yield* Effect.log("Database migrated");
});

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), {
  asPrimary: true,
});

const MainLive = AppLive.pipe(
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);

migrate.pipe(Effect.provide(MainLive), NodeRuntime.runMain);
