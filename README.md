# codemaster-frontend

Standalone Next.js admin console for Codemaster.

The frontend talks to the backend through same-origin Next.js route handlers. In OpenShift, deploy it in the same namespace as `codemaster-backend` and set `BACKEND_API_BASE_URL` to the backend Service DNS name.

## Runtime Wiring

Browser traffic should only hit the frontend route:

```text
Browser -> codemaster-frontend Route -> codemaster-frontend Service -> Next.js
```

Backend calls are made by the Next.js server through the in-namespace backend Service:

```text
Next.js -> http://codemaster-backend.<namespace>.svc/api/...
```

Do not expose the backend directly to the browser unless auth, CSRF, CORS, and cookie policy are redesigned.

## Environment

```bash
BACKEND_API_BASE_URL=http://codemaster-backend.<namespace>.svc
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_FRONTEND_TELEMETRY_ENABLED=false
```

For local development with a backend on port `8080`:

```bash
BACKEND_API_BASE_URL=http://localhost:8080
pnpm dev
```

## Development

```bash
pnpm install
pnpm codegen
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The API types are generated from `contracts/openapi.json`:

```bash
pnpm codegen
```

The current contract file is a copied compatibility snapshot. The long-term contract should be generated or published by `codemaster-backend-postgres` so frontend CI can detect backend/frontend drift.

## OpenShift

A starter deployment is provided at:

```text
deploy/openshift/codemaster-frontend.yaml
```

It deploys:

- `Deployment/codemaster-frontend`
- `Service/codemaster-frontend`
- `Route/codemaster-frontend`

The deployment sets:

```yaml
BACKEND_API_BASE_URL: http://codemaster-backend.$(POD_NAMESPACE).svc
```

If the backend Service has a different name, update this value.

## Compatibility Notes

The frontend proxies these backend surfaces:

- `/api/auth/*`
- `/api/admin/*`

Frontend telemetry is disabled by default because compatible backend deployments may not expose `/api/telemetry/fe-events`. Enable it only when that backend route exists by setting `NEXT_PUBLIC_FRONTEND_TELEMETRY_ENABLED=true`.
