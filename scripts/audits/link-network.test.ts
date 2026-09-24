import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { isPublicAddress, pinnedLookup, requestPublic, UnsafeDestinationError } from "../link-audit/network";

const publicAnswers = [{ address: "93.184.216.34", family: 4 }];
const options = () => ({ signal: AbortSignal.timeout(5_000) });

test("pinned dispatcher works with Node fetch against an explicitly allowed local server", async () => {
  const server = createServer((_request, response) => response.end("audit transport works"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://localhost:${(server.address() as AddressInfo).port}`;
    const result = await requestPublic(origin, { ...options(), allowedInternalOrigin: origin }, {
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    try { assert.equal(await result.response.text(), "audit transport works"); }
    finally { await result.cleanup(); }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("address policy rejects private, metadata, loopback, reserved and mapped private IPs", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "192.0.2.1", "2001:db8::1"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress("93.184.216.34"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("initial unsafe schemes, credentials, literal and mixed DNS addresses never reach fetch", async () => {
  let calls = 0;
  const dependencies = {
    lookup: async () => [...publicAnswers, { address: "10.0.0.1", family: 4 }],
    fetch: async () => { calls++; return new Response(""); },
  };
  for (const url of ["file:///etc/passwd", "https://user:secret@example.com/", "http://127.1/", "http://[::ffff:127.0.0.1]/", "https://mixed.example/"]) {
    await assert.rejects(requestPublic(url, options(), dependencies), UnsafeDestinationError);
  }
  assert.equal(calls, 0);
});

test("each redirect is validated before network access", async () => {
  const visited: string[] = [];
  await assert.rejects(requestPublic("https://public.example/job", options(), {
    lookup: async () => publicAnswers,
    fetch: async (input) => {
      visited.push(String(input));
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } });
    },
  }), UnsafeDestinationError);
  assert.deepEqual(visited, ["https://public.example/job"]);
});

test("explicit local audit allowance applies only to its exact origin", async () => {
  const visited: string[] = [];
  await assert.rejects(requestPublic("http://127.0.0.1:3000/jobs", { ...options(), allowedInternalOrigin: "http://127.0.0.1:3000" }, {
    fetch: async (input) => {
      visited.push(String(input));
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1:3001/private" } });
    },
  }), UnsafeDestinationError);
  assert.deepEqual(visited, ["http://127.0.0.1:3000/jobs"]);
});

test("validated DNS answers are pinned to the socket lookup", async () => {
  const resolve = pinnedLookup(publicAnswers);
  const address = await new Promise<string>((resolveAddress, reject) => {
    resolve("rebound.example", { family: 4 }, (error, result) => error ? reject(error) : resolveAddress(typeof result === "string" ? result : result[0].address));
  });
  assert.equal(address, "93.184.216.34");
  let lookups = 0;
  const result = await requestPublic("https://rebound.example/", options(), {
    lookup: async () => { lookups++; return lookups === 1 ? publicAnswers : [{ address: "127.0.0.1", family: 4 }]; },
    fetch: async (_input, init) => {
      assert.equal(init?.redirect, "manual");
      assert.ok(init && "dispatcher" in init);
      return new Response("ok");
    },
  });
  try { assert.equal(await result.response.text(), "ok"); } finally { await result.cleanup(); }
  assert.equal(lookups, 1);
});

test("redirect loops stop after five hops and DNS obeys the shared abort signal", async () => {
  let calls = 0;
  await assert.rejects(requestPublic("https://public.example/", options(), {
    lookup: async () => publicAnswers,
    fetch: async () => { calls++; return new Response(null, { status: 302, headers: { location: "/again" } }); },
  }), /redirect limit/);
  assert.equal(calls, 6);
  const controller = new AbortController();
  const pending = requestPublic("https://slow.example/", { signal: controller.signal }, {
    lookup: async () => { controller.abort(new Error("audit timeout")); return new Promise(() => {}); },
  });
  await assert.rejects(pending, /audit timeout/);
});
