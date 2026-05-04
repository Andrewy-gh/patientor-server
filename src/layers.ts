import { Layer } from "effect";
import { AppConfigLive } from "./config.js";
import { DatabaseLive } from "./db/database.js";

export const AppLive = DatabaseLive.pipe(Layer.provideMerge(AppConfigLive));
