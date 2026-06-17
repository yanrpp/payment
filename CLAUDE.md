# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A hospital cost-analysis web app for **RPP Hospital** (Thai HIS / HosXP), built on the
Next.js **Pages Router** + HeroUI. It reports patient costs, drug cost/profit, and OPD/IPD
breakdowns by querying a **HosXP Oracle database** read-only. UI strings and code comments are
predominantly in Thai — keep new user-facing text Thai unless told otherwise.

It started from the `next-pages-template` (see `README.md`, which is the upstream template
readme and not specific to this app).

## Commands

```bash
npm run dev          # dev server via scripts/dev-server.mjs (uses .next-dev dist dir)
npm run dev:clean    # wipe .next-dev then dev
npm run build        # prebuild cleans .next, then next build (uses .next dist dir)
npm run start        # production via scripts/start-production.mjs (ensures a prod build first)
npm run rebuild      # clean .next + build
npm run lint         # eslint --fix
npm run format       # prettier --write across the repo
npm run format:check # prettier verify only
```

- **No test framework is configured** — there is no test runner, and `*.test.*` files do not exist.
  "Test" endpoints under `pages/api/db/` (`test-connection.ts`, `test-ldap.ts`, `test-mysql.ts`,
  `stdtest.ts`) are manual connectivity probes hit via HTTP, not automated tests.
- Production is run under **PM2** (`ecosystem.config.cjs`, app name `payment`, port **3012**).
  `run-app.bat` is a Windows helper for build+start.

### Dev/prod cache split (important on Windows)

`next.config.js` selects `distDir` dynamically: **`.next-dev` for dev, `.next` for production**.
This is deliberate — it prevents Next.js manifest corruption on Windows (antivirus / file
watchers) when dev and prod share a cache. The `scripts/*.mjs` wrappers enforce and repair this
split (e.g. `dev-server.mjs` detects and clears corrupted dev caches; `start-production.mjs`
ensures a real prod build exists). Prefer the npm scripts over calling `next` directly. Dev on
Windows also uses webpack `poll` watching (set in `next.config.js`).

## Architecture

### Data flow

`pages/*.tsx` (client, `"use client"`) → `fetch('/api/db/...')` → API route handler →
`executeQuery` → Oracle. Pages hold all state with React hooks and do client-side
filtering/Excel export; API routes own the SQL.

### Database layer (`lib/db/` + `config/`)

- **`lib/db/connection.ts`** is the Oracle access point. Use `executeQuery<T>(sql, params, opts)`
  for single queries and `executeTransaction` for multi-statement writes — both manage
  pool checkout, commit/rollback, and release automatically. Don't call `oracledb` directly.
- Oracle runs in **Thick mode** (required for the hospital's older Oracle). It loads the Instant
  Client from `ORACLE_CLIENT_LIB_PATH`, else from `InstantClient/<platform>/` in the project.
- Every connection runs `ALTER SESSION SET CURRENT_SCHEMA = <ORACLE_SCHEMA>` (e.g. `RPP`).
- `config/database.ts` builds pool/connection config from env. Connection requires
  `ORACLE_USER` + `ORACLE_PASSWORD` and one of `ORACLE_SERVICE_NAME` / `ORACLE_SID`.
- `lib/db/mysql.ts` is a separate MySQL/MariaDB pool (template scaffolding, `DB_*` env vars);
  the real reporting data is Oracle.
- **SQL must use bind parameters** (`:name`), as every handler does — never string-interpolate
  user input into SQL. `lib/db/utils.ts#escapeIdentifier` is only for identifiers like schema
  names, not values.

### Domain SQL conventions (HosXP)

- Core HosXP tables: `ovst` (visits), `pt`/`ptno` (patients), `incpt`/`income`/`incgrp`
  (itemized charges, `incgrp=70` = Lab), `pttype` (entitlement/สิทธิ), `prsc` (prescriptions).
- **OPD vs IPD** is determined by the admit number (`an`): OPD = `ovst.an`/`prsc.an` NULL,
  IPD = `an` present. Use the helpers in **`lib/db/visitTypeSql.ts`**
  (`buildVisitTypeWhereSql`, `sqlCoalesceAn`) rather than re-deriving this logic. `ipd-*`
  pages/endpoints mirror the OPD ones with IPD filtering.
- Filter out cancelled rows with `canceldate IS NULL`.

### API route shape

Handlers in `pages/api/db/` follow a consistent contract: gate on `req.method`, validate query
params (date range as `d1`/`d2` in `YYYY-MM-DD`), build SQL with conditional bind clauses, and
return `{ success: true, count, data }` or `{ success: false, message, error? }`. Error messages
shown to users are in Thai. Follow this shape for new endpoints.

### Frontend

- **HeroUI v2** components (`@heroui/*`) + **Tailwind CSS v4** + Framer Motion. Theme via
  `next-themes`; layout primitives in `components/layout/` (`MainLayout`, `AppTopbar`, `AppFooter`).
- **Navigation is centralized in `lib/navigation/mainNav.ts`** — add a page to `MAIN_NAV_ITEMS`
  there (single source for the topbar), not ad hoc in components.
- Thai-specific input/display helpers live under `lib/`: `lib/hn/normalize.ts` (HN formats like
  `1666/69`), `lib/card/normalize.ts` (Thai ID card), `lib/date/thaiDate.ts` + `lib/format.ts`
  (Buddhist-era dates, number formatting). `components/ThaiDatePicker.tsx` / `MonthPicker.tsx`
  wrap date entry. Reuse these instead of reimplementing locale logic.
- Excel export uses `xlsx` / `xlsx-js-style`.

### Other integrations

- **LDAP** auth/lookup via `ldapts` (`LDAP_*` env, e.g. `pages/api/db/ldap-adit-members.ts`).

## Conventions

- **Path alias `@/*` → repo root** (`tsconfig.json`). Import as `@/lib/...`, `@/components/...`.
- `"type": "module"` — config/scripts are ESM (`.mjs`/`.cjs` as needed).
- Server-only packages (`mysql2`, `oracledb`) are kept out of the client bundle via
  `serverExternalPackages` + webpack/turbopack aliasing to `lib/empty-module.js`. Don't import
  them into page components.
- **Builds ignore ESLint** (`eslint.ignoreDuringBuilds: true`) — a green `next build` does NOT
  mean lint passes. Run `npm run lint` yourself.
- Prettier: 100 col, 2-space, double quotes, semicolons, `es5` trailing commas, LF.

## Secrets

`.env.local` is committed and currently contains **live hospital DB/LDAP credentials**. Do not
add new secrets to it casually, do not print these values, and do not paste them into external
services.
