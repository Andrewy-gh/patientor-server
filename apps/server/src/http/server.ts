import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { createServer } from "node:http";
import { HttpRoutes } from "./routes.ts";
import { AppConfigService } from "../config.ts";

const NodeServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfigService;
    return NodeHttpServer.layer(createServer, { port: config.port });
  }),
);

export const HttpServerLive = HttpRouter.serve(HttpRoutes).pipe(Layer.provide(NodeServerLive));
