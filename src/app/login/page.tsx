/**
 * Sprint 12 / S12.1.2 — login page.
 * Sprint 14 / S14.A — TOTP / 2FA removed per project-owner direction.
 * Sprint 20 megasprint / S17.AUTH.4 — TOTP field stripped.
 * Sprint X.2 (2026-05-11) — rewritten as a Client Component per the
 *   Anthropic Design handoff at frontend/design/codemaster-aligned/
 *   Login.html. Closes the chain of tactical patches from earlier
 *   today: the form no longer relies on `/api/auth/login` being
 *   CSRF-exempt, no longer relies on the proxy to reshape
 *   form-encoded bodies, and no longer relies on a 303 redirect.
 *
 *   On mount:
 *     1. fetch('/api/auth/csrf') — primes the csrf_token cookie +
 *        gives us the token value to mirror in X-CSRF-Token.
 *
 *   On submit:
 *     1. event.preventDefault() — keep native form navigation away.
 *     2. POST /api/auth/login with JSON body + X-CSRF-Token header.
 *     3. On 200: router.push(validatedNext || "/").
 *     4. On 4xx: setErrorCode + ErrorBanner; preserve the form.
 *
 *   Design fidelity:
 *     * Dark/light theme honors the existing toggle.
 *     * Dot-grid + ambient glow chrome from `login-*` classes in
 *       globals.css (Sprint X.2a).
 *     * SSO button visual stub — wired in Sprint AA when Keycloak
 *       OIDC lands. Click for now triggers an info banner.
 *     * CAPS Lock detection while typing the password.
 *     * Show/hide password toggle.
 *     * Spinner during submit.
 *     * Error banners include "Contact your platform owner →" link
 *       for recoverable errors (no_role, locked, ldap_unreachable).
 */

"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";

import { Button } from "@/components/ui/elements/Button";
import { SESSION_QUERY_KEY } from "@/lib/auth/use-session";
import { cn } from "@/lib/cn";
import {
  colors,
  motion as motionTokens,
  radius,
  type as t,
} from "@/lib/design-tokens";

const ERROR_COPY: Record<string, string> = {
  bad_credentials: "Invalid credentials.",
  locked: "Account locked. Try again later.",
  no_role:
    "Authentication succeeded, but this account has no codemaster role assigned.",
  ldap_unreachable:
    "Auth service temporarily unavailable. Please try again in a few minutes.",
  sso_failed:
    "SSO sign-in failed. Please try again or use your directory credentials below.",
  credential_query: "Use the sign-in form to submit credentials.",
  unknown: "Authentication failed.",
};

// Recoverable errors get a "Contact your platform owner" affordance.
const ERROR_HAS_OWNER_LINK: Record<string, true | undefined> = {
  no_role: true,
  locked: true,
  ldap_unreachable: true,
};

/**
 * Same-origin validation for `?next=`. MIRROR of the validator
 * in frontend/src/app/api/auth/login/route.ts — keep these in sync.
 * Rejects open-redirect attempts (https://evil/, //host/,
 * javascript:, data:, ../, CRLF injection, oversize).
 */
function isSafeRelativeNext(value: string | null): value is string {
  if (value === null) return false;
  if (value.length === 0 || value.length > 512) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.includes("\n") || value.includes("\r")) return false;
  return true;
}

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialError = searchParams.get("error");
  const reason = searchParams.get("reason");
  const nextParamRaw = searchParams.get("next");
  const nextParam = isSafeRelativeNext(nextParamRaw) ? nextParamRaw : null;
  const hasCredentialQuery =
    searchParams.has("username") || searchParams.has("password");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [submitting, setSubmitting] = useState<null | "directory" | "sso">(
    null,
  );
  const [errorCode, setErrorCode] = useState<string | null>(initialError);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCredentialQuery) return;

    const sanitized = new URLSearchParams();
    if (initialError) sanitized.set("error", initialError);
    if (reason) sanitized.set("reason", reason);
    if (nextParam) sanitized.set("next", nextParam);

    router.replace(sanitized.size > 0 ? `/login?${sanitized}` : "/login");
    setErrorCode("credential_query");
  }, [hasCredentialQuery, initialError, nextParam, reason, router]);

  // Sprint X.5b — preflight to seed the csrf_token cookie + read
  // the token value. The cookie is set by the middleware as a
  // side-effect of any non-exempt response; the body returns the
  // same value so we don't have to parse document.cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/csrf", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { token: string };
        if (!cancelled) setCsrfToken(body.token);
      } catch {
        // Fail open — the form submit will surface a generic error
        // banner if the token didn't arrive in time.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CAPS Lock indicator (fires while typing the password).
  const handlePasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsOn(e.getModifierState("CapsLock"));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting !== null) return;
    setSubmitting("directory");
    setErrorCode(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          schema_version: 1,
          username,
          password,
        }),
      });

      if (res.status === 200) {
        // Invalidate the cached /api/auth/me result (primed `null` at initial load) so the
        // post-login redirect re-checks the session and sees the now-authenticated user.
        // Without this, the stale cached `null` bounces straight back to /login — intermittent
        // only because it refetched once the 60s staleTime lapsed (see use-session.ts).
        await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        router.push(nextParam ?? "/");
        return;
      }

      // Map backend status → ErrorBanner key (mirrors the
      // status-to-error-code map in the proxy route handler).
      if (res.status === 401) setErrorCode("bad_credentials");
      else if (res.status === 403) setErrorCode("no_role");
      else if (res.status === 423) setErrorCode("locked");
      else if (res.status === 503) setErrorCode("ldap_unreachable");
      else setErrorCode("unknown");
    } catch {
      setErrorCode("unknown");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSso = () => {
    // Visual stub — SSO via Keycloak OIDC ships in Sprint AA.
    // Setting `sso_failed` surfaces the "Please try again or use
    // your directory credentials below" banner so the user has a
    // clear next step.
    setErrorCode("sso_failed");
  };

  return (
    <main
      id="main-content"
      className={cn(
        "relative min-h-screen w-full overflow-hidden",
        colors.bg.surface,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 login-ambient-glow pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 login-dot-grid pointer-events-none"
      />

      <div className="relative flex flex-col min-h-screen">
        {/* Header: brand left, status indicator right */}
        <header className="flex items-center justify-between px-12 py-6">
          <div className="flex items-center gap-x-2.5">
            <BrandMark size={28} />
            <span
              className={cn(
                "text-[15px]",
                t.bodyStrong,
                colors.text.primary,
              )}
            >
              codemaster
            </span>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-x-1.5",
              t.caption,
              colors.text.muted,
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
            <span>All systems operational</span>
          </div>
        </header>

        {/* Body — centered card */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[400px]">
            <div>
              <h1
                className={cn(
                  t.display,
                  colors.text.primary,
                  "text-pretty",
                )}
                style={{
                  fontSize: 56,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  fontWeight: 600,
                }}
              >
                {reason === "session-ended" ? "Welcome back." : "Sign in."}
              </h1>
              <p
                className={cn("mt-3", t.body, colors.text.muted)}
                style={{ fontSize: 15 }}
              >
                {reason === "session-ended" ? (
                  "Pick up where you left off."
                ) : (
                  <>
                    Code review at scale — every finding cites a source.
                  </>
                )}
              </p>
            </div>

            <div className="mt-7">
              {reason === "session-ended" && !errorCode ? (
                <Banner tone="info">You&apos;ve been signed out.</Banner>
              ) : null}
              {errorCode ? (
                <Banner
                  tone="danger"
                  {...(ERROR_HAS_OWNER_LINK[errorCode]
                    ? { ownerLink: true as const }
                    : {})}
                >
                  {ERROR_COPY[errorCode] ?? ERROR_COPY.unknown}
                </Banner>
              ) : null}

              {/* SSO — visual stub for v0; wired in Sprint AA. */}
              <button
                type="button"
                onClick={handleSso}
                disabled={submitting !== null}
                className={cn(
                  "login-sso-btn w-full inline-flex items-center justify-center gap-x-2.5 px-3.5 py-2.5",
                  radius.md,
                  t.bodyStrong,
                  "c-accent-ring",
                  motionTokens.fast,
                  "disabled:opacity-70 disabled:cursor-not-allowed",
                )}
              >
                {submitting === "sso" ? <Spinner /> : <SsoMark />}
                <span>
                  {submitting === "sso"
                    ? "Redirecting…"
                    : "Continue with SSO"}
                </span>
              </button>

              <div className="login-or-divider my-5">
                <span aria-hidden="true" />
                <span
                  className={cn(t.caption, colors.text.faint)}
                  style={{
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Or with directory
                </span>
                <span aria-hidden="true" />
              </div>

              <form
                method="post"
                onSubmit={handleSubmit}
                className="space-y-4"
                noValidate
              >
                <Field
                  id="username"
                  name="username"
                  label="Username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Field
                  id="password"
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={handlePasswordKey}
                  trailing={
                    <>
                      {capsOn ? <CapsHint /> : null}
                      <PasswordToggle
                        shown={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                      />
                    </>
                  }
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={submitting !== null}
                >
                  {submitting === "directory" ? (
                    <span className="inline-flex items-center gap-x-2">
                      <Spinner />
                      <span>Signing in…</span>
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between px-12 py-5">
          {/* Privacy link — destination wired in Sprint AA's Settings
              rework. For v0 it's a button-styled stub that does
              nothing on click (no href="#" + preventDefault anti-
              pattern). */}
          <button
            type="button"
            onClick={() => {
              /* intentional no-op stub */
            }}
            className={cn(
              t.caption,
              colors.text.muted,
              "underline underline-offset-2 cursor-pointer",
            )}
          >
            Privacy &amp; data handling →
          </button>
          <span
            className={cn(t.caption, colors.text.faint, "font-mono")}
          >
            v0
          </span>
        </footer>
      </div>
    </main>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

interface FieldProps {
  id: string;
  name: string;
  label: string;
  type: "text" | "password";
  autoComplete: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  trailing?: ReactNode;
}

function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  required,
  value,
  onChange,
  onKeyUp,
  trailing,
}: FieldProps): JSX.Element {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn("block mb-1.5", t.meta, colors.text.primary)}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onKeyUp={onKeyUp}
          style={trailing ? { paddingRight: 68 } : undefined}
          className={cn(
            "login-field block w-full rounded-md px-3.5 py-2.5",
            t.body,
            motionTokens.fast,
          )}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-2.5 flex items-center gap-x-1.5">
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className={cn(
        "inline-flex items-center justify-center rounded p-1",
        colors.text.faint,
        motionTokens.fast,
      )}
    >
      {shown ? (
        <svg
          viewBox="0 0 20 20"
          className="size-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l2.16 2.16C2.94 6.7 1.74 8.27 1.18 9.5a.75.75 0 0 0 0 .65c1.5 3.27 4.5 5.6 8.32 5.6 1.5 0 2.86-.36 4.04-.97l2.18 2.18a.75.75 0 1 0 1.06-1.06L3.28 2.22Zm5.5 7.62 2.4 2.4a2 2 0 0 1-2.4-2.4Zm-1.78-.66 4.84 4.84a3.5 3.5 0 0 1-4.84-4.84Z"
            clipRule="evenodd"
          />
          <path d="M9.5 5.25c-.46 0-.9.04-1.32.12L9.4 6.6a3.5 3.5 0 0 1 4 4l1.97 1.97c.95-.84 1.68-1.86 2.16-2.92a.75.75 0 0 0 0-.65c-1.5-3.27-4.5-5.6-8.03-5.75Z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 20 20"
          className="size-4"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 4.5C5.5 4.5 2 8 1 10c1 2 4.5 5.5 9 5.5s8-3.5 9-5.5c-1-2-4.5-5.5-9-5.5Zm0 8.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
        </svg>
      )}
    </button>
  );
}

function CapsHint(): JSX.Element {
  return (
    <span
      className={cn(
        "login-caps-pill inline-flex items-center gap-x-1 rounded px-1.5 py-0.5",
      )}
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
      data-testid="caps-hint"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 1.5 13.5 7H11v3.5H5V7H2.5L8 1.5Zm-3 11h6V14H5v-1.5Z" />
      </svg>
      CAPS
    </span>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4 animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path
        d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SsoMark(): JSX.Element {
  // Generic IdP glyph — NOT the Okta logotype. The button label
  // names the IdP in text.
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7.25"
        fill="none"
        stroke="oklch(72% 0.16 65)"
        strokeWidth="2.4"
      />
      <circle cx="10" cy="10" r="2.4" fill="oklch(72% 0.16 65)" />
    </svg>
  );
}

function BrandMark({ size = 44 }: { size?: number }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        colors.accent.solid,
        colors.accent.onSolid,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        fontWeight: 600,
        boxShadow:
          "0 6px 18px oklch(72% 0.16 65 / 0.30), inset 0 1px 0 oklch(100% 0 0 / 0.20)",
      }}
    >
      c
    </span>
  );
}

function Banner({
  tone,
  ownerLink,
  children,
}: {
  tone: "info" | "danger";
  ownerLink?: true;
  children: ReactNode;
}): JSX.Element {
  const palette =
    tone === "info"
      ? "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
      : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "mb-5 px-3 py-2.5 rounded-md flex items-start gap-x-2",
        t.body,
        palette,
      )}
    >
      <span
        aria-hidden="true"
        className="mt-1.5 size-1.5 rounded-full shrink-0"
        style={{ background: "currentColor", opacity: 0.7 }}
      />
      <span>
        {children}
        {ownerLink ? (
          <>
            {" "}
            <a
              href="mailto:platform-owners@acme.io"
              className="underline underline-offset-2"
              style={{ color: "currentColor", fontWeight: 600 }}
            >
              Contact your platform owner →
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}
