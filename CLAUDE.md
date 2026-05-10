# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Start dev server at localhost:4321
bun run build        # Type-check + build to ./dist/
bun run preview      # Preview production build locally
bun run lint         # Run ESLint
bun run lint:fix     # Auto-fix ESLint issues
```

Both `bun` and `pnpm` lockfiles exist; prefer `bun` for running scripts.

## Architecture

This is an **Astro 5** static blog deployed to GitHub Pages at `https://vivekx01.github.io/blog` (base path `/blog` is configured in `astro.config.mjs` — all internal links must account for this).

### Key directories

- `src/content/blog/` — All blog posts as `.md`/`.mdx` files, organized by category subdirectory
- `src/pages/` — Astro pages; `[...slug].astro` is the dynamic post renderer
- `src/components/` — Reusable `.astro` components (no React components; Mermaid is rendered via `Mermaid.astro`)
- `src/consts.ts` — Site-wide constants (name, email, social links) — edit here to change site identity
- `src/content/config.ts` — Zod schema for blog post frontmatter (source of truth for all content fields)

### Path aliases (defined in `tsconfig.json`)

`@layouts/*`, `@components/*`, `@consts`, `@types`, `@lib/*` all resolve to `src/*`.

### Content schema

Every post in `src/content/blog/**/*.md(x)` must have this frontmatter:

```yaml
---
title: "Post Title"
description: "Short summary shown in previews"
date: "YYYY-MM-DD"
draft: false          # omit or set true to hide
category: "System Design"   # shown as badge on cards
series: "System Design Series"  # optional grouping
seriesOrder: 1        # optional; controls series order
---
```

### Category routing

Categories are derived from the directory structure under `src/content/blog/`:
- `technical/system-design/` → "System Design"
- `technical/agentic-ai/` → "Agentic AI"
- `technical/debugging/` → "Debugging"
- `technical/frontend-engineering/` → "Frontend Engineering"
- `life-experiences/` → "Life Experiences"

Adding a new top-level category requires a new page route in `src/pages/blog/`.

### Diagrams

MDX posts can render Mermaid diagrams via the `<Mermaid />` component:

```mdx
import Mermaid from "@components/Mermaid.astro";
<Mermaid code={`graph TD; A-->B`} />
```

### Theme & styling

Dark/light mode is class-based (set on `<html>`), persisted in `localStorage`. Typography styles for post content come from `@tailwindcss/typography` prose classes applied in the post layout.
