import { afterEach, assert, expect, test, vi } from "vitest";
import { getJson, postJson } from "./api-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("getJson returns parsed response data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ name: "Matti Luukkainen" })),
  );

  const result = await getJson<{ name: string }>("/api/patients");

  assert.deepStrictEqual(result, { name: "Matti Luukkainen" });
});

test("postJson sends json payload", async () => {
  const fetchMock = vi.fn(async () => Response.json({ id: "patient-id" }));
  vi.stubGlobal("fetch", fetchMock);

  await postJson("/api/patients", { name: "Ada Lovelace" });

  const calls = fetchMock.mock.calls as unknown as Array<
    [RequestInfo | URL, RequestInit | undefined]
  >;

  assert.strictEqual(calls[0]?.[0], "/api/patients");
  assert.deepStrictEqual(calls[0]?.[1], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Ada Lovelace" }),
  });
});

test("getJson rejects failed responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("Invalid patient id", { status: 400 })),
  );

  await expect(getJson("/api/patients/not-valid")).rejects.toThrow("Invalid patient id");
});
