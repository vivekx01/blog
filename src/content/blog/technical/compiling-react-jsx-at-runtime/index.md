---
title: "Compiling React JSX at Runtime: Lessons from a Dynamic Widget System"
description: "A real-world engineering lesson on what breaks when React’s build-time assumptions disappear, and how compiling JSX at runtime changes the way you think about flexibility, safety, and performance."
date: "2025-12-28"
---

Recently, I tackled a frontend engineering challenge that made me pause and think:  
**if we want to write JSX at runtime and render it, how can this be done?**

When we use React to build applications, JSX gets compiled into plain JavaScript during build time. But what if we are building a system where users need the ability to create components at runtime—and we need to compile and render those components immediately?

The system being built had a feature where users could assemble UI templates dynamically. These templates were not predefined components; they were authored at runtime and needed to behave like first-class React components. That meant taking JSX provided as input and turning it into something React could actually render on the fly.

The challenge sounded straightforward but was difficult to solve in practice—especially while maintaining reasonable **safety**, **performance**, and **developer ergonomics**. I started looking for answers but found very little concrete guidance online. Eventually, I pieced together a workable approach.

This article is a breakdown of the approaches I explored, why some of them failed in practice, and the architectural lessons that emerged while building a dynamic widget system under real-world constraints.

---

## Requirements

- JSX was provided at runtime (as user-authored widget code)
- It needed to render as a real React component
- No rebuild, no redeploy
- It had to run inside an existing React application

---

## High-Level Architecture

![High Level Architecture](/blog/high-level-jsx-flow.png)

```

JSX String
↓
Runtime Transpilation (JSX → JS)
↓
Controlled Evaluation
↓
React Component Function
↓
Render via React

````

---

## Step 1: Runtime JSX Transpilation

JSX cannot be executed directly by the browser. It must first be transformed into standard JavaScript.

To achieve this, we used **Babel at runtime** (via a standalone build) to transpile JSX into executable JavaScript.

### What Babel Is and What It Actually Does

Babel is a JavaScript compiler. At a high level, it:

- Parses modern JavaScript syntax (including JSX)
- Transforms it into syntax that the runtime understands
- Outputs standard JavaScript code

Specifically for React, Babel converts JSX into calls to `React.createElement`.

![JSX Transpilation](/blog/react-compilation-diagram.jpg)

For example:

```jsx
<div>Hello</div>
````

becomes something conceptually equivalent to:

```js
React.createElement("div", null, "Hello")
```

Once in this form, the code is just JavaScript—and JavaScript can be executed dynamically.

### Key Points

* JSX was transformed into `React.createElement` calls
* No module system was allowed (`import`, `export` disabled)
* The output was a plain function definition

---

## Step 2: Controlled Evaluation (The Critical Part)

To execute the transpiled code, we used `new Function`, **not `eval`**.

### Why `new Function`

* `new Function` has a predictable scope
* It allows explicit dependency injection
* It avoids access to global variables by default

We explicitly injected only what the JSX was allowed to use:

* `React`
* Selected hooks (`useState`, `useEffect`)
* Approved utility functions

Conceptually:

```js
const createComponent = new Function(
  "React",
  "useState",
  "useEffect",
  `
    return ${transpiledCode};
  `
);
```

Calling this returned a real React component function.

### Security Constraints

This step was tightly controlled:

* No access to `window`
* No access to `document`
* No dynamic imports
* No arbitrary globals

This level of restriction was essential for safety.

---

## Step 3: Rendering the Component

Once evaluated, the result was just a function:

```js
const RuntimeComponent = createComponent(React, useState, useEffect);
```

From React’s perspective, this is no different from any other functional component.

Rendering was straightforward:

```jsx
<RuntimeComponent />
```

React handled everything else:

* Reconciliation
* State
* Effects
* Re-renders

**Key insight:** React does not care where a component comes from, as long as it is a function.

---

## What `new Function` Actually Does

This line:

```js
const createComponent = new Function(
  "React",
  "useState",
  "useEffect",
  `
    return ${transpiledCode};
  `
);
```

does **not** create a React component by itself.

What it creates is a **factory function**.

It is equivalent to writing:

```js
function createComponent(React, useState, useEffect) {
  return /* transpiledCode */;
}
```

The only difference is that the function body is generated at runtime from a string.

---

## Step 4: Error Handling and Isolation

Runtime compilation introduces failure modes that do not exist at build time.

We had to handle:

* Syntax errors in JSX
* Runtime exceptions inside user code
* Infinite render loops

Typical safeguards included:

* Wrapping evaluation in `try/catch`
* Error boundaries around runtime components
* Timeouts or execution limits
* Clear error messages surfaced back to the widget editor

Without these safeguards, a single bad widget could break the entire application.

---

## The Trade-offs

### Costs

* Runtime performance overhead
* Increased bundle size (shipping Babel)
* Expanded security surface area
* More complex debugging

This is **not** something you use casually. It is justified only when runtime flexibility is a core product requirement.

---

## Avoiding Recompile Overhead

Runtime JSX compilation is expensive. Babel performs real compiler work—parsing, transforming, and generating JavaScript. Running this on every render would be wasteful.

To address this, the compiled output was **cached and reused** until the source JSX changed. This ensured:

* Compilation happened only when the source changed
* Rendering remained fast and predictable
* React state and effects were preserved correctly

---

## Key Lesson

> The moment you remove build-time guarantees, you inherit responsibility for everything the build step normally protects you from.

Runtime JSX compilation is possible, but it forces you to think like a **compiler author**, a **security engineer**, and a **React developer** at the same time.



