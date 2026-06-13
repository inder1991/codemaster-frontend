/* ReviewDetailPage — adopted-by-copy from
 * frontend/src/app/(authed)/reviews/[id]/page.tsx
 * + frontend/src/components/review-detail/FindingCard.tsx
 *
 * Trust-traceability invariant (PRODUCT.md): every finding cites a
 * verifiable source. The CitationFootnoteBlock at the bottom of each
 * card carries the typed citation list (knowledge / spec / corpus /
 * temporal / langfuse) — kind badge + label · locator.
 */

const STATE_KIND   = { queued: "dim", in_progress: "info", complete: "healthy", failed: "down" };
const STATE_LABEL  = { queued: "Queued", in_progress: "In progress", complete: "Complete", failed: "Failed" };
const SEVERITY_KIND = { blocker: "down", issue: "degraded", suggestion: "info", nit: "dim", none: "neutral" };

/* -------------------------------------------------------------- *
 * Mock data — shape mirrors `ReviewDetailV1` from the locked       *
 * frontend/src/lib/api/admin contracts. PR is the actual           *
 * "wire TOTP enrolment to the local-super-admin path" change       *
 * referenced by the login spec.                                    *
 * -------------------------------------------------------------- */
const REVIEW = {
  review_id:    "rv_01HZQ8M2A4KX3F1J9N8Q",
  repo:         "platform/auth-service",
  pr_number:    2814,
  pr_title:     "Wire TOTP enrolment to the local-super-admin path",
  posted_at:    "2026-05-09T11:42:00Z",
  posted_at_human: "May 9 · 11:42 UTC",
  temporal_url: "https://temporal.acme.io/namespace/codemaster/workflows/wf_rv_01HZQ8M2A4KX3F1J9N8Q",
  langfuse_url: "https://langfuse.acme.io/trace/lf_rv_01HZQ8M2A4KX3F1J9N8Q",
  findings: [
    {
      finding_id: "f_001",
      severity: "blocker",
      title: "Race in TOTP secret rotation",
      body: "When two enrolment requests arrive within the 30-second replay window, the second `rotate_secret` call observes a stale `last_rotated_at` and persists a duplicate seed. The window is small but reproducible under load (see attached repro). This bypasses the \"one secret per user\" invariant locked in S0.A.",
      suggestion: "Lift the rotation into a single `SELECT … FOR UPDATE` transaction; current code reads outside the txn.",
      file_path: "codemaster/api/auth/totp.py",
      start_line: 142,
      end_line: 178,
      tool_source: "review-llm + repo_index",
      citations: [
        { kind: "knowledge", label: "TOTP rotation invariants",   locator: "L-2089 · v3", href: "/knowledge/L-2089" },
        { kind: "spec",      label: "S0.A · auth invariants",      locator: "design.md#s0-a", href: "#" },
        { kind: "temporal",  label: "rotate-secret race repro",    locator: "wf_repro_91A2",  href: "#" }
      ]
    },
    {
      finding_id: "f_002",
      severity: "issue",
      title: "TOTP code logged in plaintext on bad_totp path",
      body: "The `bad_totp` error branch passes `code` through to `audit.log_event`'s `before` payload. Audit events are retained 90 days; this is a leak. The corpus driver flagged this in the secrets corpus run.",
      suggestion: "Hash the code with the request id before audit. The `audit.redact_token` helper is available.",
      file_path: "codemaster/api/auth/login.py",
      start_line: 88,
      end_line: 96,
      tool_source: "secrets-corpus",
      citations: [
        { kind: "corpus",   label: "secrets/totp_in_audit",          locator: "case 14",  href: "#" },
        { kind: "knowledge",label: "Audit redaction · approved",      locator: "L-1471 · v8", href: "/knowledge/L-1471" }
      ]
    },
    {
      finding_id: "f_003",
      severity: "suggestion",
      title: "Lockout response can clarify the unlock window",
      body: "The 423 response message says \"Try again later.\" The locked spec for this surface says it should surface the unlock time so the operator can self-serve. Cheap win, no security tradeoff.",
      suggestion: "Return `unlock_at` in the JSON; the existing field on `AuthLockout` already carries it.",
      file_path: "codemaster/api/auth/login.py",
      start_line: 201,
      end_line: 214,
      tool_source: "review-llm",
      citations: [
        { kind: "spec", label: "Login UX states · 2026-05-04",  locator: "design.md#login-states", href: "#" }
      ]
    },
    {
      finding_id: "f_004",
      severity: "nit",
      title: "Field-order convention drift in `LoginRequest`",
      body: "Pydantic field order in `LoginRequest` puts `totp_code` before `password`. House style is request-order matches DOM order. Cosmetic.",
      suggestion: null,
      file_path: "codemaster/domain/auth.py",
      start_line: 34,
      end_line: 41,
      tool_source: "review-llm",
      citations: [
        { kind: "knowledge", label: "House style · field order", locator: "L-0312 · v2", href: "/knowledge/L-0312" }
      ]
    }
  ]
};

/* ── Primitives ─────────────────────────────────────────────── */

function Badge({ kind = "neutral", pill = false, showDot = true, size = "sm", className = "", children }) {
  const isStatus = kind !== "neutral";
  const bg   = isStatus ? `c-statusbg-${kind}` : "c-neutral-bg";
  const text = isStatus ? `c-status-${kind}`   : "c-neutral-text";
  const dot  = isStatus ? `c-statusdot-${kind}`: "c-neutral-dot";
  return (
    <span className={
      "inline-flex items-center gap-x-1.5 " +
      (pill ? "rounded-full" : "rounded-md") + " " +
      (size === "xs" ? "px-1.5 py-0.5 t-caption" : "px-2 py-0.5 t-meta") + " " +
      `${bg} ${text} ${className}`
    }>
      {showDot ? <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} /> : null}
      {children}
    </span>
  );
}

function Card({ padding = "none", raised = true, className = "", children, ...rest }) {
  const PAD = { none: "", sm: "p-3", md: "p-4", lg: "p-6" }[padding];
  return (
    <div {...rest}
         className={`rounded-xl c-bg-elevated border c-border-default ${raised ? "elev-raised" : ""} ${PAD} ${className}`}>
      {children}
    </div>
  );
}

/* ── Finding card (with citation footnote block) ────────────── */

const FINDING_BODY_TRUNCATE_AT = 500;

function FindingCard({ finding }) {
  const range = finding.start_line === finding.end_line
    ? `${finding.file_path}:${finding.start_line}`
    : `${finding.file_path}:${finding.start_line}-${finding.end_line}`;

  const [expanded, setExpanded] = React.useState(false);
  const isTruncated = finding.body.length > FINDING_BODY_TRUNCATE_AT;
  const visibleBody = !isTruncated || expanded
    ? finding.body
    : `${finding.body.slice(0, FINDING_BODY_TRUNCATE_AT)}…`;

  return (
    <Card padding="lg" data-testid="finding-card">
      <div className="flex items-start gap-x-3">
        <Badge kind={SEVERITY_KIND[finding.severity]} pill>{finding.severity}</Badge>
        <h3 className="flex-1 t-h3 c-text-primary">{finding.title}</h3>
      </div>
      <p className="mt-3 t-body-large c-text-primary" style={{ lineHeight: 1.7 }}>
        {visibleBody}
      </p>
      {isTruncated ? (
        <button type="button"
                onClick={() => setExpanded(v => !v)}
                className="mt-2 t-meta c-text-accent hover:underline underline-offset-4">
          {expanded ? "Collapse" : "Expand"}
        </button>
      ) : null}

      {finding.suggestion ? (
        <p className="mt-3 px-3 py-2 rounded-md c-bg-muted c-text-primary t-body italic">
          Suggestion: {finding.suggestion}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        <a href="#" onClick={(e) => e.preventDefault()}
           className="inline-flex items-center gap-x-1.5 px-2.5 py-1 rounded-md c-bg-muted c-text-primary t-meta c-hover-bg-elevated dur-fast">
          <window.CodeBracketIcon className="size-4 c-text-muted" />
          <span className="font-mono">{range}</span>
          <window.ExternalLinkIcon className="size-3.5 c-text-faint ml-0.5" />
        </a>
        {finding.tool_source ? (
          <span className="t-meta c-text-faint">via {finding.tool_source}</span>
        ) : null}
      </div>

      {finding.citations.length > 0 ? <CitationFootnoteBlock citations={finding.citations} /> : null}
    </Card>
  );
}

function CitationFootnoteBlock({ citations }) {
  return (
    <div className="mt-5 pt-4 border-t c-border-default">
      <p className="t-caption c-text-faint uppercase" style={{ letterSpacing: "0.08em" }}>
        Citations
      </p>
      <ul className="mt-2 space-y-1.5">
        {citations.map((c, i) => (
          <li key={`${c.kind}-${c.locator}-${i}`}>
            <a href={c.href}
               onClick={(e) => e.preventDefault()}
               className="inline-flex items-center gap-x-2 t-meta c-text-muted hover:underline underline-offset-4 dur-fast">
              <Badge kind="neutral" size="xs" showDot={false}>{c.kind}</Badge>
              <span>{c.label}</span>
              <span className="c-text-faint">·</span>
              <span className="italic">{c.locator}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Upstream-tools deep-link button ───────────────────────── */

function DeepLink({ href, label, hint }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       onClick={(e) => e.preventDefault()}
       className="inline-flex items-center gap-x-2 px-3 py-2 rounded-md c-bg-muted c-text-primary c-hover-bg-elevated dur-fast">
      <span className="t-body-strong">{label}</span>
      <span className="t-meta c-text-muted">{hint}</span>
      <window.ExternalLinkIcon className="size-4 c-text-faint" />
    </a>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

function ReviewDetailPage({ tweaks }) {
  const state = tweaks.review_state;
  const review = REVIEW;

  // Severity counts for the small summary chip on the right of the header.
  const counts = review.findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <a href="/your-reviews"
         onClick={(e) => e.preventDefault()}
         className="inline-flex items-center gap-x-1 t-meta c-text-muted c-hover-text-primary dur-fast">
        <window.ChevronLeftIcon className="size-4 c-text-faint" />
        Back to your activity
      </a>

      <header>
        <div className="flex items-center gap-x-3 flex-wrap">
          <span className="t-meta c-text-muted font-medium">{review.repo}</span>
          <span aria-hidden="true" className="c-text-faint">·</span>
          <span className="t-meta c-text-muted tabular-nums">#{review.pr_number}</span>
          <Badge kind={STATE_KIND[state]} pill>{STATE_LABEL[state]}</Badge>
        </div>
        <h1 className="mt-2 t-display c-text-primary text-pretty">{review.pr_title}</h1>
        <div className="mt-3 flex items-center gap-x-3 flex-wrap t-meta c-text-faint">
          <span>Posted <time dateTime={review.posted_at}>{review.posted_at_human}</time></span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{review.review_id}</span>
        </div>
      </header>

      {/* Severity rollup row — small enough to feel like meta, dense enough
          to give the reviewer a TL;DR before they scroll. */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-x-2.5">
            <span className="t-numeric-large c-text-primary">{review.findings.length}</span>
            <span className="t-meta c-text-muted">findings</span>
          </div>
          <div className="h-8 w-px c-bg-muted" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {["blocker","issue","suggestion","nit"].map((sev) => counts[sev] ? (
              <Badge key={sev} kind={SEVERITY_KIND[sev]} pill>
                <span className="tabular-nums">{counts[sev]}</span>
                <span>{sev}</span>
              </Badge>
            ) : null)}
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="t-h2 c-text-primary">Findings ({review.findings.length})</h2>
        <div className="space-y-4">
          {review.findings.map((f) => <FindingCard key={f.finding_id} finding={f} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="t-h2 c-text-primary">Open in upstream tools</h2>
        <Card padding="md">
          <div className="flex flex-wrap gap-2">
            <DeepLink href={review.temporal_url} label="Temporal Web"   hint="Workflow run for this review" />
            <DeepLink href={review.langfuse_url} label="Langfuse trace" hint="LLM call breakdown" />
          </div>
        </Card>
      </section>
    </div>
  );
}

Object.assign(window, { ReviewDetailPage });
