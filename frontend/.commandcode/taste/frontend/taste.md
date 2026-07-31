# Frontend Taste

- Expects premium SaaS-grade UI quality modeled on Linear, Notion, Vercel, Stripe, OpenAI: glassmorphism, soft shadows, rounded cards, animated micro-interactions, dark mode, and fully responsive layouts. Confidence: 0.9
- Prefers a strict TypeScript + React + Vite stack with functional components only, custom hooks, clean architecture, no duplicated code, and reusable typed components. Confidence: 0.9
- Prefers Tailwind CSS with shadcn/Radix-style component primitives, Framer Motion for animation, Recharts for charts, and Lucide icons. Confidence: 0.9
- Forms should use React Hook Form + Zod with inline validation. Confidence: 0.85
- Server state should be handled with TanStack Query (caching, automatic refetch, optimistic updates, retry on failure) rather than ad-hoc fetch logic. Confidence: 0.85
- Requires performance discipline: lazy-loaded routes, code splitting, memoization, and debouncing. Confidence: 0.85
- Authentication should use JWT with secure token storage, auto-refresh of login state, protected routes, and role-based routing that isolates different user roles. Confidence: 0.85
- Judges the app by actually using it: a runtime crash that blanks a page or throws uncaught console errors is a defect even when typecheck and build pass — real usage flows (e.g., logging in as a role and navigating) must render without errors. Confidence: 0.75
- Per-role navigation: each role's sidebar/menu must expose only that role's allowed features (e.g., candidates never see upload/admin items; admins get the full suite) — cross-role links are defects. Confidence: 0.85
- Never store files/media client-side (no Base64 blobs); file downloads like PDFs use blob responses with client-side object URLs, and actions that create artifacts (e.g., PDF regeneration) should trigger the download directly from a generated blob. Confidence: 0.75
