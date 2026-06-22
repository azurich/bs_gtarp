# Task 12 Report — Final-review fixes

## Final-review fixes

### FIX 1 — Missing assets 404 + hoist PAGES/pub (server.ts)
- Hoisted `pub` helper and `PAGES` map to module scope (above `const app = new Elysia()`), allocated once instead of per-request.
- In the catch-all handler, removed local redeclarations of `pub`/`PAGES`.
- Asset branch now uses `pub(clean)` (trailing-slash-stripped path) for file lookup.
- When a known-extension file does not exist: `set.status = 404; return 'Not found'` — no fallback to HTML.

### FIX 2 — Shared components follow universe accent (public/core/tokens.css)
Replaced hardcoded violet in shared component rules:
- `::-webkit-scrollbar-thumb` → `var(--accent-dim)` / `var(--accent)`
- `.btn:focus-visible` outline → `var(--accent-2)`
- `.btn.ghost` color → `var(--accent-2)`, hover border → `var(--accent)`
- `.spinner` border-top → `var(--accent)`
- `tbody tr:hover td` background → `var(--accent-soft)`

### FIX 3 — Dead line removed (public/casino.js)
Removed the no-op `const whoEl = $('whoName'); if (whoEl) whoEl.textContent = u.username;` from the boot IIFE (no `#whoName` element exists; home greeting handled by `renderHome`/`#homeUser`).

### Verification
- `bun build public/casino.js --target browser > /dev/null && echo JS_OK` → **JS_OK**
- `grep -c "rgba(91,33,182" public/core/tokens.css` → **11** (down from 16; remaining are CSS variable definitions, shadow tokens, and fallback values in `var(...)` — not shared component rules)
- curl / → **200**
- curl /casino → **200**
- curl /style.css (nonexistent asset) → **404**
- curl /core/auth.js (real asset) → **200**
