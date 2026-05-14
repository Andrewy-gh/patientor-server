import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import { AppLive } from "./layers.js";
import { HttpServerLive } from "./http/server.js";

const DotEnvLive = ConfigProvider.layerAdd(ConfigProvider.fromDotEnv(), {
  asPrimary: true,
});

const MainLive = HttpServerLive.pipe(
  Layer.provide(AppLive),
  Layer.provide(DotEnvLive),
  Layer.provide(NodeServices.layer),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
