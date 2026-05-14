import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { createServer } from "node:http";
import { HttpRoutes } from "./routes.js";
import { AppConfigService } from "../config.js";

const NodeServerLive = Layer.effect(HttpServer.HttpServer)(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return yield* NodeHttpServer.make(createServer, { port: config.port });
  }),
).pipe(Layer.provide(NodeHttpServer.layerHttpServices));

export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(Layer.provide(NodeServerLive));
