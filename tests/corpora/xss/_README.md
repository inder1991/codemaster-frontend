# XSS adversarial corpus — Sprint 14 / S14.B

JSON-format corpus consumed by the frontend ReviewDetailPage test
driver (`frontend/tests/pages/ReviewDetailPage.test.tsx`). Each entry
asserts that finding/title text containing executable HTML or
URL-injection payloads renders as escaped plain text in the React
DOM — no `dangerouslySetInnerHTML` is permitted on this page.

JSON (not YAML like the backend corpora) because the consumer is a
TypeScript test driver and JSON imports are first-class in the
toolchain.

Each entry shape:

```json
{
  "id": "xss-NNNN-<short-name>",
  "field": "title" | "body",
  "input": "<the raw payload>",
  "expected_escaped_output": "<what the rendered DOM textContent should equal>",
  "notes": "..."
}
```

`expected_escaped_output` is the literal string the rendered DOM is
expected to display. React JSX escaping turns `<script>` into the
literal `<script>` text node; the test driver asserts the payload
appears verbatim AND that no `<script>` element is created in the DOM.
