/**
 * Root redirect. Role-based: platform_owner / super_admin land on
 * the tenant-wide dashboard; everyone else lands on their own
 * /your-reviews page (engineer-flavored). Replaces the implicit
 * 404 at `/` and the previous unconditional /dashboard redirect.
 *
 * Sprint 14 / S14.A: now reads role from the real session via
 * `useSession()` (was `MOCK_SESSION`). Client-side redirect — the
 * loading state renders nothing so the user never sees a flash of
 * the wrong page.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/auth/use-session";

export default function Home() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.isLoading) return;
    if (session.data === null) {
      router.replace("/login");
      return;
    }
    if (session.data) {
      const role = session.data.role;
      if (role === "platform_owner" || role === "super_admin") {
        router.replace("/dashboard");
      } else {
        router.replace("/your-reviews");
      }
    }
  }, [session.isLoading, session.data, router]);

  // Render nothing during the redirect — avoids flashing.
  return null;
}
