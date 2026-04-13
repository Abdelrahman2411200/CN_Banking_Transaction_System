# Design System Specification: Architectural Precision

## 1. Overview & Creative North Star

### The Creative North Star: "The Sovereign Ledger"
In the world of cloud-native banking, trust is not built through marketing fluff; it is built through **Architectural Precision**. This design system moves away from the "web-app" feel and toward a "high-performance instrument" aesthetic. We treat data as the hero. 

The system rejects the generic "SaaS Blue" template in favor of an **Editorial Brutalism** approach: high-contrast typography, expansive white space, and a refusal to use decorative lines. We create depth through tonal shifts and sophisticated layering rather than outdated borders. The result is a UI that feels solid, authoritative, and impossibly clean—a digital vault for modern finance.

---

## 2. Color & Tonal Architecture

Our palette is rooted in a spectrum of cool grays and architectural neutrals, punctuated by highly specific semantic triggers.

### The "No-Line" Rule
**Borders are a legacy constraint.** In this system, explicit 1px solid lines for sectioning are strictly prohibited. Boundaries must be defined through:
- **Tonal Shifts:** Placing a `surface-container-low` element against a `surface` background.
- **Negative Space:** Using the spacing scale to create psychological groupings.

### Surface Hierarchy & Nesting
We treat the UI as a series of physical layers. Use the `surface-container` tiers to create "nested" depth:
- **Foundation:** `surface` (#f7f9fb) for the primary application backdrop.
- **Level 1 (The Shell):** `surface-container-low` (#f0f4f7) for the sidebar or secondary navigation zones.
- **Level 2 (The Workspaces):** `surface-container-highest` (#d9e4ea) for active data areas or header bars.
- **Level 3 (The Focus):** `surface-container-lowest` (#ffffff) for the actual data cards or "paper" sheets where transactions are processed.

### Semantic Integrity
- **Success (Emerald):** Use for completed transactions.
- **Error (`error` #9f403d):** Use for failed validations or critical system alerts. 
- **Warning (Amber):** Use for pending approvals or high-risk flags.
- **Info (`tertiary` #006499):** Use for system notifications and neutral data links.

---

## 3. Typography: The Editorial Scale

We use **Inter** exclusively. It is the typeface of modern infrastructure. Our hierarchy focuses on "Scanning" rather than "Reading."

*   **Display (lg/md/sm):** Used only for high-level dashboard summaries (e.g., Total AUM).
*   **Headline (lg/md/sm):** Reserved for page titles. Use `headline-sm` (1.5rem) for major section headers.
*   **Title (lg/md/sm):** The workhorse for data table headers and modal titles. `title-sm` (1rem) should be used for bolded column headers to create an authoritative "Editorial" feel.
*   **Body (lg/md/sm):** `body-md` (0.875rem) is the system default for data entry and description text.
*   **Label (md/sm):** Used for micro-data, timestamps, and metadata tags. These should use `on-surface-variant` (#566166) to reduce visual noise.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Stacking**. To lift a component, do not simply add a shadow; change its surface token. An active transaction card should sit on `surface-container-lowest` (#ffffff) to naturally "pop" against the `surface-container` (#e8eff3) background.

### Ambient Shadows
When a floating element (like a context menu or modal) is required:
- **Opacity:** Keep shadows between 4% and 8%.
- **Color:** Never use pure black. Use a tinted version of `on-surface` (#2a3439).
- **Blur:** Use large, diffused values (20px to 40px) to mimic natural ambient light.

### The "Ghost Border" Fallback
If accessibility requirements demand a border (e.g., in high-contrast modes), use the **Ghost Border**: 
- Token: `outline-variant` (#a9b4b9)
- Opacity: **15% max.**
- It should feel like a suggestion of an edge, not a cage.

---

## 5. Components

### AppShell & Sidebar
- **Sidebar:** Use `surface-container-low`. Navigation items should have no background in their default state. On hover/active, use `primary-container` (#dae2fd) with a 4px vertical "accent bar" on the leading edge.
- **Main Header:** Use `surface-bright`. No shadow. Define the bottom edge with a subtle tonal shift to `surface-dim`.

### Data Tables (The Core)
- **Rows:** Strictly forbid divider lines. Use a 12px vertical gap between rows.
- **Zebra Striping:** Use `surface-container-lowest` for the row background and `surface-container-low` for the "stripe."
- **Focus State:** On hover, a row should transition to `surface-variant` (#d9e4ea).

### Buttons
- **Primary:** `primary` (#565e74) background with `on-primary` (#f7f7ff) text. Corner radius: `lg` (0.5rem).
- **Secondary:** Transparent background with `outline` (#717c82) Ghost Border.
- **Tertiary:** No border, no background. Use `tertiary` (#006499) text for interactive "text-only" actions.

### Status Chips
- **Container:** Use the `container` version of the semantic color (e.g., `error-container` #fe8983) at 20% opacity.
- **Text:** Use the high-contrast `on-container` token.
- **Shape:** Use `full` (9999px) for a "Pill" look that distinguishes metadata from interactive buttons.

### Input Fields
- **Background:** `surface-container-lowest` (#ffffff).
- **Border:** `outline-variant` at 20% opacity.
- **Active State:** The border transitions to `primary` (#565e74) at 100% opacity. No "glow" effects.

---

## 6. Do’s and Don'ts

### Do
- **Use White Space as a Separator:** If you feel the urge to add a line, add 16px of padding instead.
- **Embrace Data Density:** Use `label-sm` for secondary metrics to pack information without clutter.
- **Use Tonal Nesting:** A modal should be `surface-container-lowest` sitting on a `scrim` overlay.

### Don't
- **Don't use 100% Black:** It is too harsh for fintech. Use `on-surface` (#2a3439) for maximum readability without eye strain.
- **Don't use Shadows for everything:** Only use shadows for "Temporary" surfaces (tooltips, menus, modals). Static layouts must use tonal shifts.
- **Don't use Gradients:** We are building a system of record. Clarity comes from flat, confident color blocks.
- **Don't use Center-Alignment:** For an operational portal, stick to a rigid left-aligned grid to assist eye-tracking across data rows.