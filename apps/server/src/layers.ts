import { Layer } from "effect";
import { AppConfigLive } from "./config.ts";
import { DatabaseLive } from "./db/database.ts";
import { PatientRepositoryLive } from "./patients/repository.ts";

const DatabaseLayer = DatabaseLive.pipe(Layer.provideMerge(AppConfigLive));

export const AppLive = PatientRepositoryLive.pipe(Layer.provideMerge(DatabaseLayer));
