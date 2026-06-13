import type { NextConfig } from "next";

// Sprint Y.8 (2026-05-11) — defense-in-depth response headers.
// `frame-ancestors 'none'` is the modern equivalent of
// `X-Frame-Options DENY`; we set both for older browsers.
// `'unsafe-inline'` on style-src is required by Tailwind's
// runtime-injected styles; tightening to nonces is an AA hardening item.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  typedRoutes: true,
  output: "standalone",
  // Runtime API proxying lives in src/app/api/{admin,telemetry}/[...path].
  // Do not use rewrites for backend service calls: Next evaluates those
  // with build-time config, which breaks kind/OpenShift runtime env wiring.
  async redirects() {
    return [
      {
        // S21.LLM-DUAL.0 task 15 — /admin/bedrock permanently moved to /admin/llm.
        // Catches direct browser hits before the auth layer processes them.
        source: "/admin/bedrock",
        destination: "/admin/llm",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default config;
