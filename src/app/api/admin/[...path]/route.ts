import { NextRequest, NextResponse } from "next/server";

import { proxyBackendApi } from "../../_proxy";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = await context.params;
  return proxyBackendApi(request, "admin", params.path ?? []);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
