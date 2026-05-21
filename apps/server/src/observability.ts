import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Otlp } from "effect/unstable/observability";
import { AppConfigService } from "./config.ts";

export const ObservabilityLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfigService;

    if (!config.tracingEnabled) {
      return Layer.empty;
    }

    return Otlp.layerJson({
      baseUrl: config.otlpEndpoint,
      resource: {
        serviceName: "patientor-server",
      },
    }).pipe(Layer.provide(NodeHttpClient.layerUndici));
  }),
);
