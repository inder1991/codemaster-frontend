import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  "http://codemaster-backend";
const BACKEND_PROXY_TIMEOUT_MS = 30_000;

const HOP_BY_HOP_HEADERS = new Set([
  "accept-encoding",
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function backendUrl(prefix: "admin" | "telemetry", path: string[], search: string): string {
  const base = BACKEND_API_BASE_URL.replace(/\/+$/, "");
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(`${base}/api/${prefix}/${encodedPath}`);
  url.search = search;
  return url.toString();
}

function requestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== "host") {
      headers.set(key, value);
    }
  });
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });
  return headers;
}

function copyUpstreamSetCookies(upstream: Response, response: NextResponse): void {
  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const setCookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(upstream.headers)
      : [];
  for (const cookie of setCookies) {
    response.headers.append("Set-Cookie", cookie);
  }
}

export async function proxyBackendApi(
  request: NextRequest,
  prefix: "admin" | "telemetry",
  path: string[] = [],
): Promise<NextResponse> {
  const method = request.method.toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_PROXY_TIMEOUT_MS);
  const init: RequestInit = {
    method,
    headers: requestHeaders(request),
    signal: controller.signal,
    cache: "no-store",
  };

  try {
    if (method !== "GET" && method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }
    const upstream = await fetch(
      backendUrl(prefix, path, request.nextUrl.search),
      init,
    );
    const body =
      upstream.status === 204 || upstream.status === 304
        ? null
        : await upstream.arrayBuffer();
    const response = new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders(upstream),
    });
    copyUpstreamSetCookies(upstream, response);
    return response;
  } catch {
    return NextResponse.json(
      { detail: "backend unavailable" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
