import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { PatientorApi } from "@patientor/api";

export const HealthApiLive = HttpApiBuilder.group(PatientorApi, "health", (handlers) =>
  handlers.handle("ping", () => Effect.succeed("pong")),
);
