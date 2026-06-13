/**
 * Sprint 12 — authed layout. Wraps every admin page in the
 * SidebarShell + role-aware nav (DESIGN.md role-aware-navigation
 * matrix).
 *
 * Sprint 14 / S14.A: replaced `MOCK_SESSION` import with real
 * `useSession()` TanStack Query hook against `/api/auth/me`.
 * On 401 (data === null) the layout redirects to /login.
 *
 * Marked "use client" because Heroicons component references
 * are passed through `NavItem.icon` — function values cannot
 * cross the server→client boundary in Next.js 15. Reading
 * `usePathname` here also drives the active-state highlight.
 */

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { IdleWarningBanner } from "@/components/IdleWarningBanner";
import { ToastContainer } from "@/components/ui/Toast";
import { SidebarShell } from "@/components/ui/application-shells/SidebarShell";
import type { NavItem } from "@/components/ui/application-shells/SidebarShell";
import type { Role } from "@/lib/auth/roles";
import { useIdleTimer } from "@/lib/auth/use-idle-timer";
import { useSession } from "@/lib/auth/use-session";
import { initTelemetry } from "@/lib/telemetry";

import { NAV_SPEC } from "./nav-spec";

export default function AuthedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  // 401 → redirect to /login, preserving the current path as
  // `?next=` so the user lands back where they were after
  // signing in (Sprint X.5c, 2026-05-11). The login route handler
  // validates `next` is a same-origin relative path before honoring
  // it — open-redirect-safe.
  useEffect(() => {
    if (!session.isLoading && !session.error && session.data === null) {
      const next = pathname && pathname !== "/login" ? pathname : null;
      router.replace(
        next ? `/login?next=${encodeURIComponent(next)}` : "/login",
      );
    }
  }, [session.isLoading, session.error, session.data, router, pathname]);

  // Initialize optional page-load telemetry once per session.
  // Idempotent; disabled unless NEXT_PUBLIC_FRONTEND_TELEMETRY_ENABLED=true.
  useEffect(() => {
    initTelemetry();
  }, []);

  // Sprint X.9 (2026-05-11) — idle timer. Spec line 1825:
  // "Sessions: 12 hr, 1 hr idle." The 12h is enforced backend-side
  // via the cookie's expires_at; this hook handles the 1h idle
  // policy client-side with a 5min "Sign me out / Stay signed in"
  // banner before auto-logout.
  const [idleRemainingMs, setIdleRemainingMs] = useState<number | null>(null);
  useIdleTimer({
    onWarn: (remainingMs) => setIdleRemainingMs(remainingMs),
    onIdle: () => {
      // Navigate to the logout GET — same path the sidebar menu
      // uses; preserves the cookie-clear + redirect-to-/login flow.
      window.location.href = "/api/auth/logout";
    },
  });

  // Initial paint while the session resolves: render nothing rather than
  // a partial shell, to avoid a flash of role-incorrect navigation.
  if (session.isLoading || !session.data) {
    return null;
  }

  const role: Role = session.data.role;
  const email = session.data.email;
  const userId = session.data.user_id;

  const navigation: NavItem[] = NAV_SPEC.filter((n) =>
    n.visibleTo.includes(role),
  ).map((n) => ({
    name: n.name,
    href: n.href,
    icon: n.icon,
    // Active-match: exact OR pathname starts with `${href}/`
    current: pathname === n.href || pathname.startsWith(`${n.href}/`),
  }));

  return (
    <>
      <SidebarShell
        navigation={navigation}
        userNavigation={[
          { name: "Sign out", href: "/api/auth/logout" },
        ]}
        user={{
          id: userId,
          name: email.split("@")[0] ?? "user",
          email,
          role,
        }}
      >
        {children}
      </SidebarShell>
      <IdleWarningBanner
        remainingMs={idleRemainingMs}
        onDismiss={() => setIdleRemainingMs(null)}
        onSignOut={() => {
          window.location.href = "/api/auth/logout";
        }}
      />
      {/* Sprint Y.5 (2026-05-11) — global toast container. Mounted
          once at the authed-shell root; useToast() in any descendant
          page emits into this container. */}
      <ToastContainer />
    </>
  );
}
