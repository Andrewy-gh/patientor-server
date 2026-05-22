import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import { AppLive } from "./layers.ts";
import { HttpServerLive } from "./http/server.ts";
import { ObservabilityLive } from "./observability.ts";

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), {
  asPrimary: true,
});

const MainLive = Layer.mergeAll(HttpServerLive, ObservabilityLive).pipe(
  Layer.provide(AppLive),
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
