import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ??
  "http://codemaster-backend";

const AUTH_UPSTREAM_TIMEOUT_MS = 10_000;

type AuthUpstreamOptions = {
  body?: BodyInit;
  headers?: HeadersInit;
  method: "GET" | "POST";
  path: "/api/auth/csrf" | "/api/auth/login" | "/api/auth/logout" | "/api/auth/me";
};

export async function fetchAuthUpstream(
  options: AuthUpstreamOptions,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_UPSTREAM_TIMEOUT_MS);
  const init: RequestInit = {
    method: options.method,
    signal: controller.signal,
    cache: "no-store",
  };
  if (options.headers !== undefined) {
    init.headers = options.headers;
  }
  if (options.body !== undefined) {
    init.body = options.body;
  }
  try {
    return await fetch(`${BACKEND_API_BASE_URL}${options.path}`, init);
  } finally {
    clearTimeout(timer);
  }
}

export function backendUnavailable(): NextResponse {
  return NextResponse.json(
    { detail: "backend unavailable" },
    { status: 502 },
  );
}

export function copyUpstreamSetCookies(
  upstream: Response,
  response: NextResponse,
): void {
  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const setCookies =
    typeof getSetCookie === "function"
      ? getSetCookie.call(upstream.headers)
      : [];
  for (const sc of setCookies) {
    response.headers.append("Set-Cookie", sc);
  }
}

export async function proxyAuthTextResponse(
  upstream: Response,
): Promise<NextResponse> {
  const upstreamBody = await upstream.text();
  const response = new NextResponse(upstreamBody, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
  copyUpstreamSetCookies(upstream, response);
  return response;
}

export function authForwardHeaders(
  request: NextRequest,
  headers: Record<string, string>,
): HeadersInit {
  return {
    ...headers,
    Cookie: request.headers.get("Cookie") ?? "",
  };
}
