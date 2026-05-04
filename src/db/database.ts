import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { config } from "../config";
import { DB } from "./generated";

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: config.databaseUrl,
    }),
  }),
});
