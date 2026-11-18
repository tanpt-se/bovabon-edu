---
name: Bovabon Edu
description: LMS tiếng Việt để ôn lập trình và tiếng Anh CNTT.
colors:
  paper: "#f1e9d8"
  surface: "#f8f3e8"
  surface-muted: "#e9e1d0"
  rule: "#c8bea8"
  ink: "#292c28"
  ink-muted: "#625f55"
  moss: "#4f6853"
  on-moss: "#fffdf7"
  moss-wash: "#e1e7d9"
  success: "#3f6d4e"
  success-wash: "#e0e9dc"
  error: "#a64137"
  error-wash: "#f1ddd5"
  warning: "#78551c"
  warning-wash: "#efe2c4"
  code-bg: "#292c28"
  code-ink: "#f1e9d8"
  code-gutter: "#c3b9a5"
  dark-paper: "#25251f"
  dark-surface: "#2f3028"
  dark-surface-muted: "#38392f"
  dark-rule: "#4c4a3c"
  dark-ink: "#f1e9d8"
  dark-ink-muted: "#c5baa3"
  dark-moss: "#a9c19e"
  dark-on-moss: "#24261f"
  dark-moss-wash: "#3d4938"
  dark-success: "#a2caa4"
  dark-success-wash: "#354536"
  dark-error: "#f1a096"
  dark-error-wash: "#4a302c"
  dark-warning: "#e5c583"
  dark-warning-wash: "#4a3d27"
  dark-code-bg: "#1c1d18"
  dark-code-ink: "#f1e9d8"
typography:
  display:
    fontFamily: "Source Sans 3, Avenir Next, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 2.7vw, 2.5rem)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Source Sans 3, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontFamily: "Source Sans 3, Avenir Next, Segoe UI, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: "Source Sans 3, Avenir Next, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Source Sans 3, Avenir Next, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  code:
    fontFamily: "ui-monospace, SF Mono, JetBrains Mono, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "2px"
  sm: "4px"
  control: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.moss}"
    textColor: "{colors.on-moss}"
    typography: "650 15px Source Sans 3"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "650 13px Source Sans 3"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "400 16px Source Sans 3"
    rounded: "{rounded.lg}"
    padding: "9px 12px"
  nav-link-active:
    backgroundColor: "{colors.moss-wash}"
    textColor: "{colors.moss}"
    typography: "500 14px Source Sans 3"
    rounded: "{rounded.md}"
    padding: "10px"
  status-chip:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success}"
    typography: "600 12px Source Sans 3"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  reading-container:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  ordered-catalog-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "14px 8px 14px 0"
---

# Design System: Bovabon Edu

## Overview

**Creative North Star: "Sổ thực hành"**

Bovabon Edu is a Vietnamese learning space for developers reviewing programming and IT English. Its visual language borrows the useful parts of a study notebook: warm paper, clear section order, narrow margin marks, and tabular exercise numbers. Real course and local progress data remain the focus; paper is a color and organizational cue, not a texture or prop.

The catalog behaves like a printed contents page that opens into a digital lesson. The interface favors ruled rows, readable type, and a single clear next action. It avoids the dashboard of repeated metric tiles, uniform catalog cards, decorative gradients, and faux paper grain chosen against in the direction brief.

**Key Characteristics:**
- Warm ivory surfaces and charcoal text, with moss reserved for navigation and primary actions.
- Ordered course and exercise rows instead of a repeated card grid.
- Progress shown from the learner's local browser data and described as local.
- Flat surfaces; borders and spacing carry most of the hierarchy.
- Responsive navigation and content that remain usable at narrow widths.

## Colors

The light palette pairs warm, low-chroma paper tones with charcoal ink and a restrained moss accent; semantic colors identify grading and warning states.

### Primary
- **Pressed Moss** (#4f6853): Main action, active navigation, links, focus outline, and selection. In explicit dark mode it becomes Pale Moss (#a9c19e).

### Neutral
- **Notebook Paper** (#f1e9d8): Default page background.
- **Reading Surface** (#f8f3e8): Sidebar, dialogs, and contained reading surfaces.
- **Inset Paper** (#e9e1d0): Secondary surfaces and quiet control fills.
- **Soft Rule** (#c8bea8): Dividers, field outlines, and table rules.
- **Charcoal Ink** (#292c28): Main text and code surface.
- **Margin Ink** (#625f55): Supporting text and labels.

### Tertiary
- **Grading Green** (#3f6d4e): Successful checks in the light theme.
- **Correction Red** (#a64137): Failed checks and destructive actions.
- **Caution Ochre** (#78551c): Warnings and partial progress.

### Named Rules
**The Ink-on-Paper Rule.** Keep body copy on a warm paper surface and use color to mark meaningful actions or learning states, never as a substitute for state text.

**The Explicit Night Rule.** Dark colors apply only after the learner chooses the dark theme; operating-system preference does not silently change the notebook default.

## Typography

**Display Font:** Source Sans 3 (with Avenir Next, Segoe UI, and sans-serif fallbacks)
**Body Font:** Source Sans 3 (with Avenir Next, Segoe UI, and sans-serif fallbacks)
**Label/Mono Font:** ui-monospace, SF Mono, JetBrains Mono, Menlo, Consolas, monospace

**Character:** Source Sans 3 keeps Vietnamese learning text readable across long explanations while accommodating the compact labels in a course catalog. Monospaced tabular numerals give exercise numbers, progress counts, and code a distinct practical voice.

### Hierarchy
- **Display** (650, clamp(2rem, 2.7vw, 2.5rem), 1.2): Page titles and track titles.
- **Headline** (650, 1.35rem, 1.2): Main content section headings.
- **Title** (700, 1.1rem, 1.2): Compact subsection headings.
- **Body** (400, 16px, 1.55): Learning content and interface copy.
- **Label** (600, 12px, 1.4, sentence case): Counts, metadata, and section labels.
- **Code** (400, 13px, 1.6): Code samples and tabular exercise identifiers.

### Named Rules
**The Readable Lesson Rule.** Keep lesson explanations at the stable 16px body size; reserve larger type for page and section hierarchy.

## Layout

On desktop, the shell uses a 248px navigation rail and a main view capped at 1440px. The main view uses 40px horizontal padding at wide widths; the home catalog and local-progress note form two columns, with the catalog taking the larger share. Courses and coding exercises use ordered rows with a tabular index, a flexible text column, and concise progress or test metadata.

At 1100px, the home note moves below the catalog in one column. At 1000px, multi-column learning layouts and the code workspace stack. At 760px, the navigation becomes a drawer, the view uses compact 18px side padding, course rows reflow their progress metadata below the title, and the local-progress note stays after the catalog. Wide lesson tables scroll in their own focusable region and show a hint when scrolling is needed.

The spacing rhythm is drawn from the existing 8–16px component insets and 24–40px section or page separations. Keep the contents-page rows close enough to scan while leaving lesson sections visibly distinct.

## Elevation & Depth

The system is flat by default. Paper tone, ruled dividers, and layout create hierarchy; one soft shadow is used for the mobile navigation drawer and confirmation dialog, where overlap needs to be clear.

### Shadow Vocabulary
- **Overlay separation** (`0 8px 24px rgba(45, 40, 30, .14)`): Mobile drawer and modal confirmation only.

### Named Rules
**The Flat-By-Default Rule.** Do not add shadows to catalog rows or ordinary lesson sections; reserve the existing shadow for overlays.

## Shapes

Rows are mostly square and separated by fine rules. Controls use the existing compact radius scale: 2px, 4px, 6px, 8px, 10px, and 12px; chips alone use the pill radius. The catalog's vertical index rule is a navigation cue, not a faux notebook illustration. Tables keep visible cell rules so their structure remains legible while scrolling.

## Components

### Buttons
Buttons are compact, direct controls with enough contrast to read as actions without becoming decorative blocks.
- **Shape:** 6px radius.
- **Primary:** Moss background and warm-white text, 650 weight at 15px, with 10px 16px padding.
- **Hover / Focus:** Slight brightness change on hover; a 2px moss focus outline with 3px offset for keyboard focus.
- **Secondary / Ghost:** Secondary keeps a thin rule; ghost stays transparent until hover, when it receives the inset-paper fill.

### Chips
Chips are quiet status labels, not a second button system.
- **Style:** 12px text, 2px 9px padding, pill radius, and an inset-paper fill by default.
- **State:** Success, failure, warning, and active variants use their corresponding semantic colors and soft fills.

### Cards / Containers
Containers mark distinct task boundaries such as question prompts and the confirmation dialog; the home catalog is not card-based.
- **Corner Style:** 12px on generic reading cards; 10px on feedback and form groups.
- **Background:** Reading surface or inset paper, depending on hierarchy.
- **Shadow Strategy:** Flat; only the confirmation dialog uses the overlay shadow.
- **Border:** Add only where a task or interaction requires a visible boundary.
- **Internal Padding:** Common container padding is 20px; dialog content uses 24px.

### Inputs / Fields
Fields remain readable against the paper surface.
- **Style:** Transparent background, 1.5px soft-rule border, 10px radius, and 9px 12px padding.
- **Focus:** 2px moss outline with 3px offset.
- **Error / Disabled:** Grading feedback uses correction red; disabled actions reduce opacity and use a not-allowed cursor.

### Navigation
Desktop navigation is a 248px reading rail with grouped links. Active links use moss ink on a soft moss fill; hover uses inset paper. On mobile, the rail becomes an explicitly opened drawer with a visible close control. Escape and the close button return focus to the menu trigger; route selection moves focus to the new page heading.

### Ordered Catalog Row
The course and coding-exercise row is the signature component: a tabular index sits at the margin, content stays flexible, and actual progress or test metadata remains in a stable trailing column. On small screens, metadata moves below the title instead of forcing horizontal overflow.

## Do's and Don'ts

### Do:
- **Do** use the named palette and font stacks from the frontmatter.
- **Do** show real catalog counts and locally stored progress; explain where progress is saved.
- **Do** keep course and exercise discovery in readable, ordered rows.
- **Do** use sentence-case labels and numeric metadata that can be scanned quickly.
- **Do** preserve keyboard focus visibility, mobile drawer focus behavior, and local theme choice.

### Don't:
- **Don't** turn the home catalog into a repeated dashboard card grid.
- **Don't** add fake paper grain, notebook props, hero gradients, or decorative metric tiles.
- **Don't** imply that learner progress is synced to an account or another device.
- **Don't** use color alone to convey pass, fail, warning, or selection states.
- **Don't** let tables or code samples make the page wider than its viewport.
