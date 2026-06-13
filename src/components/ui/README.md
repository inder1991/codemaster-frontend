# UI Components — adopt-by-copy policy

Per Sprint 12 / S12.1.1, every UI component under
`frontend/src/components/ui/<category>/<PascalCaseName>.tsx`
follows the **adopt-by-copy** pattern:

1. **Source:** `vendor/application-ui-v4/react/<category>/<file>.jsx`
   is the visual baseline. Read once, convert to TypeScript
   with explicit prop interfaces, adapt to codemaster's
   navigation / data shape.
2. **No runtime import** of `vendor/application-ui-v4/` —
   eslint enforces this via `no-restricted-imports`. The
   vendor tree is read-only documentation.
3. **TSDoc marker** on line 1 of every adopted file:
   `@adopted-from vendor/application-ui-v4/<category>/<file>.jsx`.
4. **Vendor utilities** (e.g., the `classNames` helper)
   re-implemented locally under `frontend/src/lib/`. Never
   imported from vendor.

## Categories (locked Sprint 12)

| Path | Sprint-12 component | Adopted source |
|---|---|---|
| `application-shells/` | `SidebarShell.tsx` | `react/application-shells/sidebar/03-sidebar-with-header.jsx` |
| `lists/` | `ReviewsTable.tsx` | `react/lists/tables/04-full-width.jsx` |
| `overlays/` | `Modal.tsx` | `react/overlays/modal-dialogs/01-centered-with-single-action.jsx` |
| `states/` | `Loading.tsx` / `Empty.tsx` / `Error.tsx` | head-of-UI design (S12.1.1b; not vendor-derived) |

## Adding a new component

1. Pick the variant from `vendor/application-ui-v4/react/<category>/`
   that matches the visual goal.
2. Create `frontend/src/components/ui/<category>/<PascalName>.tsx`
   with:
   - Line 1 TSDoc carrying the `@adopted-from` marker.
   - Explicit prop interface; no `any`.
   - Imports only from `@headlessui/react`, `@heroicons/react`,
     `@/lib/cn`, and our own `frontend/src/lib/`.
3. Add a unit test under `tests/frontend/components/<category>/`.
4. Add a Storybook story under
   `frontend/src/components/ui/<category>/<PascalName>.stories.tsx`
   (S12.1.1c).
