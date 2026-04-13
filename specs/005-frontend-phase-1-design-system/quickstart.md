# Quickstart: Frontend Phase 1 Design System Extraction

## Prerequisites

- Node.js 20.
- Repository dependencies installed with `npm install`.
- The Phase 0 frontend workspace exists, or create it before implementing Phase 1.
- Static references are available under `stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal`.
- Optional live gateway at `VITE_API_BASE_URL`, defaulting locally to `http://localhost:8080`, for the Phase 1 `/health` probe.

## Implementation Steps

1. Confirm the frontend workspace location.

   Recommended path:

   ```text
   services/web-portal
   ```

2. Add or update the portal theme configuration.

   Expected files:

   ```text
   services/web-portal/tailwind.config.ts
   services/web-portal/src/styles/globals.css
   services/web-portal/src/design-system/tokens.ts
   services/web-portal/src/design-system/theme.ts
   services/web-portal/src/design-system/status.ts
   services/web-portal/src/lib/api/health.ts
   ```

3. Extract tokens from the Vault Protocol first.

   Use:

   ```text
   stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/vault_protocol/DESIGN.md
   ```

4. Cross-check tokens against representative static exports.

   Suggested references:

   ```text
   stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/authentication/code.html
   stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/authentication_dark/code.html
   stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/account_management_1/code.html
   stitch_remix_of_cn_banking_react_portal/stitch_remix_of_cn_banking_react_portal/account_management_dark/code.html
   ```

5. Implement primitive components.

   Expected structure:

   ```text
   services/web-portal/src/components/primitives/
   services/web-portal/src/components/layout/
   ```

6. Add a reference gallery or temporary design-system route.

   It should show:

   - light and dark theme switching;
   - all button variants;
   - form controls;
   - status chips;
   - metric card;
   - data table states;
   - dialog/toast examples;
   - app shell/sidebar/topbar sample.
   - gateway health probe states for healthy, degraded, and unavailable responses.

7. Add focused tests.

   Cover:

   - rendering primitives in both themes;
   - accessible labels for icon-only controls;
   - disabled/loading states;
   - status chip semantics;
   - table empty/loading/error states.

## Verification Commands

Use the workspace script names once the portal workspace exists:

```text
npm run lint -w services/web-portal
npm run typecheck -w services/web-portal
npm test -w services/web-portal
npm run build -w services/web-portal
```

To review the reference gallery locally:

```text
npm run dev -w services/web-portal
```

Open the dev server URL printed by Vite and review the root gallery page.

## Manual Review Checklist

- Tokens are centralized and not copied into page components.
- The root `light` / `dark` theme switch updates the same component instances.
- Static layout separation uses tonal shifts and spacing by default.
- Ghost borders appear only where they provide affordance or accessibility.
- Inter and Material Symbols are loaded once for the app.
- Long labels, IDs, balances, and statuses stay inside their containers.
- The reference gallery includes at least one light and one dark composition.
- The reference gallery uses `authentication`, `authentication_dark`, `account_management_1`, and `account_management_dark` as canonical parity references.
- The `/health` probe displays healthy/degraded/unavailable states without blocking the gallery.
- The manual reviewer acceptance checklist lives in `services/web-portal/src/app/gallery/README.md`.
