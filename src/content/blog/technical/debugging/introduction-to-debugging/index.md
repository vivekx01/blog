---
title: "Getting Started with Astro: A Modern Web Framework"
description: "Learn the basics of Astro, a modern static site generator that delivers zero JavaScript by default."
date: "2024-01-15"
---

Astro is a modern web framework for building fast, content-focused websites. It's designed to ship less JavaScript to the browser, resulting in faster page loads and better performance.

## Why Astro?

Astro stands out from other frameworks because it:

- **Ships zero JavaScript by default** - Only loads JavaScript when you explicitly need it
- **Framework agnostic** - Use React, Vue, Svelte, or any other framework you prefer
- **Content-focused** - Perfect for blogs, documentation, and marketing sites
- **Island Architecture** - Load interactive components only where needed

## Getting Started

To create a new Astro project, run:
h
npm create astro@latestThis will guide you through setting up your project with all the necessary dependencies.

## Key Concepts

### Components

Astro components use a `.astro` extension and combine HTML, CSS, and JavaScript in a single file. They're compiled at build time, so no JavaScript is sent to the browser unless you use client-side directives.

### Pages

Pages in Astro are created in the `src/pages/` directory. They can be `.astro`, `.md`, or `.mdx` files. Each file automatically becomes a route in your site.

### Content Collections

Astro's content collections provide type-safe content management. You can define schemas for your content and get full TypeScript support.

## Conclusion

Astro is an excellent choice for building modern websites that prioritize performance and developer experience. Its unique approach to JavaScript makes it perfect for content-heavy sites while still allowing you to add interactivity when needed.

Start building with Astro today and experience the difference!