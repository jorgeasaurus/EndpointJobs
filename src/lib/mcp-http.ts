/** Native MCP clients omit Origin. Browser clients require an explicit allowed origin. */
export function withMcpHttp(
  handler: (request: Request) => Promise<Response>,
  allowedOrigins: readonly string[]
) {
  return async (request: Request) => {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    if (origin !== null && !allowedOrigins.includes(origin)) {
      return new Response("Origin not allowed", { status: 403, headers });
    }
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version");
    }
    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      // Allow protocol evolution without reflecting arbitrary application headers.
      const requested = (request.headers.get("access-control-request-headers") ?? "")
        .split(",").map((header) => header.trim().toLowerCase()).filter(Boolean);
      if (requested.some((header) => !["accept", "content-type"].includes(header) && !/^mcp-[a-z0-9-]+$/.test(header))) {
        return new Response("Header not allowed", { status: 403, headers });
      }
      headers.set("Access-Control-Allow-Headers", requested.join(", "));
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      headers.set("Allow", "POST, OPTIONS");
      return new Response("Use POST for stateless MCP requests", { status: 405, headers });
    }
    const response = await handler(request);
    for (const [key, value] of headers) response.headers.set(key, value);
    return response;
  };
}

export function getMcpAllowedOrigins(requestUrl: string) {
  const origins = ["https://endpointjobs.dev", "https://www.endpointjobs.dev"];
  for (const hostname of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (hostname) origins.push(`https://${hostname}`);
  }
  origins.push(...(process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  const url = new URL(requestUrl);
  if (!process.env.VERCEL && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    origins.push(url.origin);
  }
  return origins;
}
