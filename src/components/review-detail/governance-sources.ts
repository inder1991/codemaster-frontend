/**
 * Review-detail P2-B — group finding citations by governing source.
 *
 * The policy half of the scorecard comes from the backend `governance`
 * block (applied + violated/satisfied). The Confluence / linter / repo
 * groups are derived here from the per-finding `citations[]`:
 *   - confluence    = knowledge_chunk whose locator starts with "confluence:"
 *   - repoKnowledge = the remaining knowledge_chunk citations
 *   - linter        = linter_rule citations
 * policy_rule citations are excluded (covered by the backend scorecard).
 * Deduped by locator.
 */

import type {
  ReviewFindingCitationV1,
  ReviewFindingItemV1,
} from "@/lib/api/admin";

export interface CitationSourceGroups {
  confluence: ReviewFindingCitationV1[];
  repoKnowledge: ReviewFindingCitationV1[];
  linter: ReviewFindingCitationV1[];
}

export function groupCitationsBySource(
  findings: ReviewFindingItemV1[],
): CitationSourceGroups {
  const seen = new Set<string>();
  const groups: CitationSourceGroups = {
    confluence: [],
    repoKnowledge: [],
    linter: [],
  };
  for (const finding of findings) {
    for (const c of finding.citations ?? []) {
      const key = `${c.kind}:${c.locator}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (c.kind === "linter_rule") {
        groups.linter.push(c);
      } else if (c.kind === "knowledge_chunk") {
        if (c.locator.startsWith("confluence:")) {
          groups.confluence.push(c);
        } else {
          groups.repoKnowledge.push(c);
        }
      }
      // repo_path + policy_rule intentionally excluded.
    }
  }
  return groups;
}
