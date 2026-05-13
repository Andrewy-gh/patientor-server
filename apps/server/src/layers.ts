import { Layer } from "effect";
import { AppConfigLive } from "./config.js";
import { DatabaseLive } from "./db/database.js";
import { PatientRepositoryLive } from "./patients/repository.js";

const DatabaseLayer = DatabaseLive.pipe(Layer.provideMerge(AppConfigLive));

export const AppLive = PatientRepositoryLive.pipe(
  Layer.provideMerge(DatabaseLayer),
);
