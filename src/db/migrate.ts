import { sql } from 'kysely';
import { db } from "./database.js";

const migrate = async () => {
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
};

migrate()
  .then(async () => {
    console.log('Database migrated');
    await db.destroy();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await db.destroy();
    process.exit(1);
  });
