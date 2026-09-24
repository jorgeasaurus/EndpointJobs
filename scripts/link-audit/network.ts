import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent } from "undici";

export class UnsafeDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDestinationError";
  }
}

type PublicRequestOptions = {
  signal: AbortSignal;
  headers?: HeadersInit;
  allowedInternalOrigin?: string;
};
type Dependencies = {
  lookup?: (hostname: string) => Promise<LookupAddress[]>;
  fetch?: typeof globalThis.fetch;
};

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** Pin socket DNS to the answers already checked, including multi-address lookups. */
export function pinnedLookup(addresses: readonly LookupAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const candidates = options.family ? addresses.filter((entry) => entry.family === options.family) : addresses;
    if (!candidates.length) {
      callback(new Error("No validated address for requested family"), "", 0);
      return;
    }
    if ("all" in options && options.all) {
      // Node's all:true callback is overloaded at runtime but not in LookupFunction.
      (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, [...candidates]);
    } else {
      callback(null, candidates[0].address, candidates[0].family);
    }
  };
}

/** Validate and pin each hop; the caller owns the final response body and cleanup. */
export async function requestPublic(value: string, options: PublicRequestOptions, dependencies: Dependencies = {}) {
  let current: URL;
  try { current = new URL(value); } catch { throw new UnsafeDestinationError("Invalid audit URL"); }
  const resolve = dependencies.lookup ?? ((hostname: string) => dns.lookup(hostname, { all: true, verbatim: true }));
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const allowedOrigin = options.allowedInternalOrigin ? new URL(options.allowedInternalOrigin).origin : undefined;
  for (let redirects = 0; ; redirects++) {
    options.signal.throwIfAborted();
    if (!["http:", "https:"].includes(current.protocol) || current.username || current.password) {
      throw new UnsafeDestinationError("Audit URLs must use HTTP(S) without credentials");
    }
    const hostname = current.hostname.replace(/^\[|\]$/g, "");
    const family = isIP(hostname);
    const addresses = family ? [{ address: hostname, family }] : await abortable(resolve(hostname), options.signal);
    if (!addresses.length || addresses.some((entry) => !isIP(entry.address))) {
      throw new UnsafeDestinationError("Audit hostname has no valid addresses");
    }
    if (current.origin !== allowedOrigin && addresses.some((entry) => !isPublicAddress(entry.address))) {
      throw new UnsafeDestinationError("Audit destination resolves to a non-public address");
    }
    const agent = new Agent({ connect: { lookup: pinnedLookup(addresses) } });
    try {
      const response = await fetcher(current.href, {
        signal: options.signal,
        headers: options.headers,
        redirect: "manual",
        dispatcher: agent,
      } as RequestInit & { dispatcher: Agent });
      const location = response.headers.get("location");
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        await response.body?.cancel();
        await agent.destroy();
        if (redirects >= 5) throw new UnsafeDestinationError("Audit redirect limit exceeded");
        current = new URL(location, current);
        continue;
      }
      return { response, cleanup: async () => { await agent.destroy(); } };
    } catch (error) {
      await agent.destroy();
      throw error;
    }
  }
}
