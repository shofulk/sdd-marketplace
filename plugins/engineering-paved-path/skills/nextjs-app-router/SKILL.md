---
name: nextjs-app-router
description: Next.js 15 App Router rules — file conventions, the Server/Client Component boundary, data fetching and the Next.js 15 caching defaults, Server Functions, route handlers, error handling and metadata — each rule linked to the official Next.js 15 documentation. Use when writing, reviewing or planning code under a Next.js `app/` directory: adding a page, layout or route handler, deciding where 'use client' goes, fetching or caching data, writing a Server Action, handling errors, or adding metadata.
---

# Next.js App Router (Next.js 15)

Every rule below is written from the Next.js 15 documentation and links the page it comes from.
When the project runs a later major version, check the matching docs first — caching defaults
in particular have changed between majors. Read the project's own conventions before
prescribing; where the docs leave a choice open, the project's existing choice wins.

Docs root: <https://nextjs.org/docs/15/app>.

## 1. File conventions

Source: [Project structure](https://nextjs.org/docs/15/app/getting-started/project-structure),
[Layouts and pages](https://nextjs.org/docs/15/app/getting-started/layouts-and-pages).

- A folder is a route segment; a segment becomes public only when it holds a `page` (UI) or a
  `route` (API) file. Other files in `app/` can be colocated safely.
- The special files: `layout` (shared UI that wraps children and keeps state across
  navigation), `page`, `loading` (a Suspense fallback for the segment), `error` (an error
  boundary), `not-found`, `global-error`, `route` (API endpoint), `template` (a layout that
  re-mounts on navigation), `default` (fallback for parallel routes).
- The root layout is required and must render `<html>` and `<body>`.
- Dynamic segments are `[slug]`, catch-all `[...slug]`, optional catch-all `[[...slug]]`.
- `(group)` folders organise routes without adding to the URL; `_private` folders opt
  themselves and their children out of routing.
- `route` and `page` cannot sit in the same segment — move the API one level down (for
  example `app/api/...`).

## 2. Server and Client Components

Source: [Server and Client Components](https://nextjs.org/docs/15/app/getting-started/server-and-client-components),
[`'use client'`](https://nextjs.org/docs/15/app/api-reference/directives/use-client).

- Layouts and pages are Server Components by default. Keep them on the server unless the
  component needs state, event handlers, effects, browser APIs or custom hooks.
- `'use client'` at the top of a file marks a boundary: that file, everything it imports and
  every component it renders join the client bundle. Put the directive on the smallest
  interactive leaf (a search box), not on a layout or page.
- Props that cross from a Server to a Client Component must be serializable.
- To nest server-rendered UI inside a Client Component, pass it as `children` (or another
  prop) from a Server Component parent; it is rendered on the server ahead of time.
- React context does not work in Server Components. Wrap the provider in a Client Component
  that takes `children`, and render it as deep in the tree as possible.
- A third-party component that uses client-only features without its own `'use client'`
  needs a thin Client Component wrapper before a Server Component can render it.
- Guard server-only modules with `import 'server-only'` (a build error if a Client Component
  imports them); `client-only` marks the opposite. Only `NEXT_PUBLIC_` environment variables
  reach the client bundle; others are replaced by an empty string there.

## 3. Fetching data

Source: [Fetching data](https://nextjs.org/docs/15/app/getting-started/fetching-data).

- Fetch in Server Components: make the component `async` and `await` either `fetch` or the
  ORM / database client directly — no API round trip to your own route handler.
- Avoid accidental waterfalls. Segments render in parallel, but two `await`s in one component
  run one after the other; start independent requests together (`Promise.all`) and await
  sequentially only when one request needs the other's result.
- Stream slow parts: a `loading` file streams the whole segment; `<Suspense>` streams a single
  component. Design loading states that show the shape of the content.
- In Client Components, either read a promise passed down from a Server Component with
  React's `use` hook inside `<Suspense>`, or use a client data library (SWR, TanStack Query)
  with its own caching rules.
- `fetch` calls with `GET`/`HEAD` and the same URL and options are memoized within one render
  pass. For ORM calls that several components (or `generateMetadata` and the page) need,
  wrap the data function in React's `cache`.

## 4. Caching and revalidation — the Next.js 15 defaults

Source: [Caching and revalidating](https://nextjs.org/docs/15/app/getting-started/caching-and-revalidating),
[Caching guide](https://nextjs.org/docs/15/app/guides/caching),
[Route segment config](https://nextjs.org/docs/15/app/api-reference/file-conventions/route-segment-config).

- `fetch` responses are **not cached by default** in Next.js 15. Opt in per request with
  `cache: 'force-cache'`, or with `next: { revalidate: <seconds> }` for time-based freshness.
- A route without dynamic inputs is still prerendered and its HTML cached, even when its
  `fetch` calls are uncached. To guarantee request-time rendering, use a Dynamic API or
  `{ cache: 'no-store' }` / the `connection()` API.
- Dynamic APIs — `cookies()`, `headers()`, the `searchParams` page prop — opt the route into
  dynamic rendering. Read them only where the output really depends on the request.
- Segment config: `export const dynamic = 'force-dynamic'` (render per request),
  `'force-static'`, `'error'`; `export const revalidate = <seconds>`; `dynamicParams = false`
  to serve only paths from `generateStaticParams`.
- Cache non-`fetch` work (ORM queries) across requests with `unstable_cache`, giving it key
  parts and `tags` / `revalidate`.
- After a mutation, invalidate with `revalidatePath('/path')` or `revalidateTag('tag')` from a
  Server Function or route handler; tag the data with `next.tags` or the `unstable_cache` tags.
- The client Router Cache does not cache page segments by default in Next.js 15 (layouts and
  loading states are still reused); `router.refresh()` and revalidation in a Server Function
  clear it.

## 5. Dynamic route params

Source: [Layouts and pages](https://nextjs.org/docs/15/app/getting-started/layouts-and-pages),
[`route.js`](https://nextjs.org/docs/15/app/api-reference/file-conventions/route).

- In Next.js 15, `params` and `searchParams` are **promises**: `const { slug } = await params`
  in pages, layouts, `generateMetadata` and route handlers (`context.params`). Type them as
  `Promise<{ slug: string }>`.
- Use `generateStaticParams` to prerender known dynamic paths at build time; it must return
  an array, even an empty one, or the route renders dynamically.

## 6. Mutations — Server Functions

Source: [Updating data](https://nextjs.org/docs/15/app/getting-started/updating-data),
[`'use server'`](https://nextjs.org/docs/15/app/api-reference/directives/use-server).

- Write mutations as Server Functions (`'use server'` at the top of a file, or at the top of
  an async function inside a Server Component). Invoke them through `<form action>` or
  `formAction`, or from event handlers in Client Components.
- They are reachable by a direct `POST`, not only through your UI: authenticate and authorize
  inside every Server Function before touching data.
- Validate the input on the server (form data arrives as strings).
- After the write, revalidate (section 4) and `redirect` if the flow needs it; show progress
  with `useActionState` / pending states.

## 7. Route handlers

Source: [Route handlers and middleware](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware),
[`route.js`](https://nextjs.org/docs/15/app/api-reference/file-conventions/route).

- `app/**/route.ts` exports one function per HTTP method (`GET`, `POST`, `PUT`, `PATCH`,
  `DELETE`, `HEAD`, `OPTIONS`); an unsupported method gets `405`.
- Route handlers are **not cached by default** in Next.js 15 (changed from static in the 15
  RC). Opt a `GET` handler into caching with `export const dynamic = 'force-static'`; other
  methods are never cached.
- Use them for non-UI consumers (webhooks, third-party clients). A Server Component should
  read its data directly rather than calling its own route handler.
- `NextRequest` / `NextResponse` extend the Web `Request` / `Response`; `headers()` returns a
  read-only instance, so set headers on a new `Response`.

## 8. Middleware

Source: [Route handlers and middleware](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware).

- One `middleware.ts` at the project root (or in `src/`), next to `app/`. Split logic into
  modules and import them there.
- Use it for fast redirects, rewrites and header changes. It is not the place for slow data
  fetching or session management, and `fetch` cache options have no effect in it.

## 9. Error handling

Source: [Error handling](https://nextjs.org/docs/15/app/getting-started/error-handling).

- Expected errors (validation, a failed request) are values: return them from the Server
  Function and render them with `useActionState`; in Server Components, branch on the
  response instead of throwing.
- Unexpected errors are thrown and caught by the nearest `error` file. Error boundaries must
  be Client Components (`'use client'`).
- `notFound()` renders the segment's `not-found` UI. `global-error` replaces the root layout
  when it fails, so it renders its own `<html>` and `<body>`.

## 10. Metadata

Source: [Metadata and OG images](https://nextjs.org/docs/15/app/getting-started/metadata-and-og-images),
[`generateMetadata`](https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata).

- Export a static `metadata` object, or `generateMetadata` when it depends on data, from a
  layout or page. Both are supported only in Server Components.
- `meta charset` and `meta viewport` are added by default.
- When the page and `generateMetadata` need the same data, wrap the loader in React's
  `cache` so it runs once.
- File-based metadata (`favicon.ico`, `icon`, `opengraph-image`, `robots`, `sitemap`) lives in
  the segment it applies to and stays static unless it uses Dynamic APIs.

## Review checklist

1. No `'use client'` on a layout or page without a reason; the boundary sits on the
   interactive leaf.
2. No secret or server-only module imported from a Client Component; `server-only` guards it.
3. Independent data requests start in parallel; slow parts stream behind `loading` or
   `<Suspense>`.
4. Caching is a decision: every cached `fetch` / `unstable_cache` has a revalidation story,
   every mutation revalidates what it changed.
5. `params` / `searchParams` are awaited.
6. Every Server Function and route handler that writes authenticates and authorizes.
7. Errors: expected ones returned, unexpected ones caught by an `error` boundary.
