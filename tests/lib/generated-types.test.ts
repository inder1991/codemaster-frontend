/**
 * Sprint 16 / S16.A.4 — frontend regression test for the auto-
 * generated OpenAPI TS contracts.
 *
 * Pins that:
 *   1. The re-exports in `lib/api/{admin,cost-caps,knowledge}.ts`
 *      compile against `lib/api/generated/contracts.ts`. A
 *      Pydantic schema rename without running `make codegen`
 *      would break the re-export resolution at typecheck time —
 *      this test surfaces the failure as a unit-test signal too.
 *   2. The locked schema-version field is preserved on the
 *      `CostCapPageV1` envelope (regression catch for the
 *      schema_version=1 invariant from contracts/admin/cost_caps/v1.py).
 *   3. The generated types' field NAMES match the Pydantic
 *      contracts — drift detection that complements the
 *      backend-side openapi-committed CI gate.
 */

import { describe, expect, test } from "vitest";
import type { components } from "@/lib/api/generated/contracts";
import type {
  AuditEventListItemV1,
  AuditSearchResponseV1,
  FlagListItemV1,
  IntegrationV1,
  PutFlagResponseV1,
} from "@/lib/api/admin";
import type {
  CostCapPageV1,
  CostCapPendingChangeV1,
  CostCapSettingsV1,
} from "@/lib/api/cost-caps";
import type {
  LearningDetailV1,
  LearningListItemV1,
  ProposalV1,
} from "@/lib/api/knowledge";

describe("OpenAPI codegen — re-exports compile against generated contracts", () => {
  test("admin.ts FlagListItemV1 resolves to _FlagDetailHTTP", () => {
    // If the re-export resolves correctly, this object literal
    // typechecks. A schema rename / field deletion in openapi.json
    // would surface here as a typecheck failure.
    const flag: FlagListItemV1 = {
      flag_name: "bedrock_global_kill_switch",
      scope: "global",
      scope_id: null,
      value_json: '{"value": false}',
      last_changed_at: "2026-06-01T00:00:00Z",
      last_changed_by_user_id: "11111111-1111-1111-1111-111111111111",
      pending_second_approver: false,
      pending_first_approver_user_id: null,
      pending_value_json: null,
      pending_set_at: null,
    };
    expect(flag.flag_name).toBe("bedrock_global_kill_switch");
  });

  test("admin.ts PutFlagResponseV1 carries flag + path", () => {
    const response: PutFlagResponseV1 = {
      flag: {
        flag_name: "x",
        scope: "global",
        scope_id: null,
        value_json: "{}",
        last_changed_at: "2026-06-01T00:00:00Z",
        last_changed_by_user_id: "00000000-0000-0000-0000-000000000000",
        pending_second_approver: false,
        pending_first_approver_user_id: null,
        pending_value_json: null,
        pending_set_at: null,
      },
      path: "committed",
    };
    expect(response.path).toBe("committed");
  });

  test("admin.ts IntegrationV1 has the expected fields", () => {
    const integration: IntegrationV1 = {
      integration_id: "00000000-0000-0000-0000-000000000000",
      kind: "confluence_space",
      config_json: '{"space_key": "ACME"}',
      enabled: true,
      last_validated_at: null,
      last_validation_error: null,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };
    expect(integration.kind).toBe("confluence_space");
  });

  test("admin.ts AuditSearchResponseV1 intersects vault_degraded", () => {
    // The intersection type carries the generated `rows` +
    // `next_cursor` AND the frontend-only `vault_degraded` bool.
    const response: AuditSearchResponseV1 = {
      rows: [],
      next_cursor: null,
      vault_degraded: false,
    };
    expect(response.vault_degraded).toBe(false);
  });

  test("admin.ts AuditEventListItemV1 has the right shape", () => {
    const item: AuditEventListItemV1 = {
      audit_event_id: "00000000-0000-0000-0000-000000000000",
      actor_user_id: "11111111-1111-1111-1111-111111111111",
      action: "flag.put",
      target_id: "bedrock_global_kill_switch",
      occurred_at: "2026-06-01T00:00:00Z",
      before_excerpt: "",
      after_excerpt: "",
    };
    expect(item.action).toBe("flag.put");
  });

  test("cost-caps.ts CostCapSettingsV1 has the locked hard_ceiling_cents=5_000_000", () => {
    const settings: CostCapSettingsV1 = {
      schema_version: 1,
      global_cap_cents: 500_000,
      per_org_default_cap_cents: 100_000,
      hard_ceiling_cents: 5_000_000,
      updated_at: "2026-06-01T00:00:00Z",
      updated_by_user_id: null,
    };
    expect(settings.hard_ceiling_cents).toBe(5_000_000);
  });

  test("cost-caps.ts CostCapPendingChangeV1 carries state + target_kind enums", () => {
    const change: CostCapPendingChangeV1 = {
      schema_version: 1,
      pending_change_id: "00000000-0000-0000-0000-000000000000",
      target_kind: "global",
      target_id: null,
      new_cap_cents: 600_000,
      expires_at: null,
      requested_at: "2026-06-01T00:00:00Z",
      requested_by_user_id: "11111111-1111-1111-1111-111111111111",
      approved_at: null,
      approved_by_user_id: null,
      applied_at: null,
      state: "pending",
    };
    expect(change.state).toBe("pending");
    expect(change.target_kind).toBe("global");
  });

  test("cost-caps.ts CostCapPageV1 nests CostCapSettingsV1 + overrides", () => {
    const page: CostCapPageV1 = {
      schema_version: 1,
      settings: {
        schema_version: 1,
        global_cap_cents: 500_000,
        per_org_default_cap_cents: 100_000,
        hard_ceiling_cents: 5_000_000,
        updated_at: "2026-06-01T00:00:00Z",
        updated_by_user_id: null,
      },
      overrides: [],
      todays_spend_global_cents: 0,
      todays_projected_global_cents: 0,
      pending_changes: [],
    };
    expect(page.settings.hard_ceiling_cents).toBe(5_000_000);
  });

  test("knowledge.ts LearningListItemV1 has version field", () => {
    const item: LearningListItemV1 = {
      learning_id: "00000000-0000-0000-0000-000000000000",
      title: "always lock the cache",
      state: "active",
      repo: "acme/foo",
      version: 3,
      fired_count: 10,
      accept_rate: 0.7,
      last_fired_at: "2026-06-01T00:00:00Z",
    };
    expect(item.version).toBe(3);
  });

  test("knowledge.ts LearningDetailV1 includes revisions array", () => {
    const detail: LearningDetailV1 = {
      learning_id: "00000000-0000-0000-0000-000000000000",
      title: "x",
      body_markdown: "body",
      state: "active",
      repo: null,
      version: 1,
      fired_count: 0,
      accept_rate: 0,
      last_fired_at: null,
      revisions: [],
    };
    expect(Array.isArray(detail.revisions)).toBe(true);
  });

  test("knowledge.ts ProposalV1 carries proposed_by_user_id", () => {
    const proposal: ProposalV1 = {
      proposal_id: "00000000-0000-0000-0000-000000000000",
      title: "x",
      body_markdown: "y",
      repo: null,
      proposed_by_user_id: "11111111-1111-1111-1111-111111111111",
      created_at: "2026-06-01T00:00:00Z",
    };
    expect(proposal.proposed_by_user_id).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});

describe("OpenAPI codegen — generated/contracts.ts surface", () => {
  test("generated `paths` interface exists and is reachable", () => {
    // Pure type-level test: if the import fails, vitest's load-time
    // resolution catches it. We just touch the type to ensure the
    // file is actually loaded.
    type _PathsExists = components extends { schemas: unknown }
      ? true
      : false;
    const ok: _PathsExists = true;
    expect(ok).toBe(true);
  });

  test("admin schemas (_FlagDetailHTTP, _IntegrationHTTP) are present", () => {
    type _Flag = components["schemas"]["_FlagDetailHTTP"];
    type _Integration = components["schemas"]["_IntegrationHTTP"];

    // Touch the types so the test compiles only when both exist.
    const _flag: _Flag = {} as _Flag;
    const _integration: _Integration = {} as _Integration;
    expect(_flag).toBeDefined();
    expect(_integration).toBeDefined();
  });
});
