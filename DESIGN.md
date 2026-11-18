---
name: Bovabon Edu
description: LMS tiếng Việt để ôn lập trình và tiếng Anh CNTT.
colors:
  bg: "#f5f0e6"
  surface: "#fffdf7"
  surface-2: "#eee7d9"
  border: "#ded4c2"
  border-strong: "#c8baa2"
  text: "#29291f"
  muted: "#655f52"
  accent: "#355d48"
  accent-hover: "#294c3a"
  on-accent: "#fffdf7"
  accent-soft: "#e6eadc"
  ok: "#356b4a"
  bad: "#a84434"
  warn: "#8a5a1c"
  dark-bg: "#0f1311"
  dark-surface: "#171c19"
  dark-surface-2: "#1f2522"
  dark-border: "#2a312d"
  dark-text: "#e8ece9"
  dark-muted: "#9ba59e"
  dark-accent: "#6cc893"
typography:
  family: "Source Sans 3 (self-hosted), Avenir Next, Segoe UI, system-ui, sans-serif"
  mono: "ui-monospace, SF Mono, JetBrains Mono, Menlo, Consolas, monospace"
  display: "clamp(1.75rem, 2.2vw, 2.125rem) / 700"
  heading: "1.25rem / 700"
  title: "1.125rem / 700"
  body: "15.5px / 1.6"
  lesson: "1.0625rem / 1.75, max 72ch"
radius:
  control: "6px"
  panel: "8px"
  pill: "99px"
---

# Design System: Bovabon Edu

## Direction

Bovabon Edu should feel like a well-kept study notebook: warm paper, ink-like text, restrained green accents and thin rules that help learners scan a large library. The dashboard puts the next lesson first, presents progress as a ruled row, and treats practice links and learning paths as an indexed catalog rather than a wall of cards.

All tokens live in `:root` of `static/app.css`. The learner can choose the dark theme, which keeps the same hierarchy and changes the token values.

## Color and type

- Paper background `#f5f0e6`, page surface `#fffdf7`, quiet surface `#eee7d9`.
- Ink `#29291f`, secondary ink `#655f52`, moss accent `#355d48`.
- Use semantic colors for graded states, with text and an icon alongside color.
- Source Sans 3 is the interface face; system monospace is reserved for code and identifiers.
- Use the spacing tokens in `static/app.css`; align controls at 40px minimum and keep page-level buttons at 44px.

## Layout

- Sidebar is 264px on desktop. The top bar remains quiet and opaque, with a 1200px content limit.
- Dashboard order: page heading, continue-learning note, four progress figures, quick-practice index, then grouped learning-path rows.
- Stats, practice links and category entries use thin rules and open space instead of repeated rounded containers.
- Category page presents the path summary, primary practice action, question types and module list.
- Lessons stay at a readable 72ch width; code and tables may use the full content width and scroll within their own container.
- At 1100px, summary figures and quick links use two columns. At 760px, navigation becomes a drawer and catalog rows stack into one column. No page should scroll sideways at 375px.

## Components

- Controls have a 6px radius; larger panels use 8px. Use shadows only where a layer needs separation, such as a dialog.
- Primary buttons use moss fill, secondary buttons use paper with a clear border, and ghost buttons remain text-first.
- Progress bars are thin and rectangular. Keep the category completion percentage visible next to the bar.
- Answer options have a clear border and a visible selected state; graded states include a label and icon.
- Interface and learning-path icons use Tabler symbols from `static/icons.svg`. Use semantic symbols rather than initials or emoji as logos.

## Content and accessibility

- Put the next useful action first, and keep one filled primary action per region.
- Show actual question counts and local progress. State clearly that progress remains in this browser unless optional sync is enabled.
- Interface labels are Vietnamese by default; add their English equivalents to `static/i18n.js`.
- Preserve visible keyboard focus, reduced-motion preferences, readable contrast and 40px minimum touch targets.
- Check both languages, light and dark themes, desktop and 375px layouts after UI changes.
