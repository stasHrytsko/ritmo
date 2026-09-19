# Ritmo — MVP V1

Ritmo is a personal, local-first tracker built around one timeline:

**Day → Week → Month → Year**

It separates two kinds of progress:

- **Routine** — repeating boolean actions. On scheduled days: done / not done.
- **Goal** — a finite object with a start date, end date and a list of tasks.

## V1 features

- Today view with days/weeks left in the year
- Routine completion
- Automatic satisfaction for routines not scheduled that day
- Daily medal when every routine requirement for the day is satisfied
- Weekly sprint overview
- Month calendar
- Year overview
- Goals with weekly tasks
- Notes: a standing backlog of things to do some day
- Routine scheduling by weekday
- JSON backup/export and restore/import, validated before it replaces anything
- Installable PWA
- Offline-first storage with IndexedDB
- Light and dark themes: System, Light or Dark, under Life → Appearance

## Architecture

```
UI
↓
Application / Use Cases
↓
Domain
↓
Repository Interfaces
↓
IndexedDB Adapter
```

UI and domain code never talk to IndexedDB directly. That makes it possible to add a Supabase adapter or sync layer later without rewriting the product.

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Checks (lint, types, tests) — the same set CI runs:

```bash
npm run check
```

## Notes

The Notes block at the bottom of Today is a backlog: anything to remember to
do some day, with no date on it. It is the same list whichever day is on
screen, it sits outside the medal rule entirely, and it is where goals come
from. It starts collapsed, because it is reference material rather than
today's work.

## Themes

Life → Appearance switches between System, Light and Dark. The choice is a
per-device display preference, so it lives in browser storage rather than in
the app database — restoring a backup taken on a phone should not repaint a
laptop. An inline script in `index.html` applies it before the first paint,
so a stored theme never flashes the other one on load.

## The day boundary

A day ends at `dayBoundaryHour` (03:00), not at midnight. Ticking off a
routine at 01:00 lands on the day you are still living rather than one that
has barely started, and the app rolls over on its own while it stays open.

## Storage

V1 has no backend and no authentication. Data stays on the device in IndexedDB.

GitHub stores code only — never user data.

## Product rule: daily medal

For every active routine:

- scheduled today + done → satisfied
- scheduled today + not done → not satisfied
- not scheduled today → automatically satisfied

A medal is earned when all active routines are satisfied. Auto-satisfied routines do **not** create fake completion records.

Each week stores its routine plan as dated revisions. Editing routines mid-week
adds a revision starting that day, so days already lived keep the plan they were
judged against and past medals never change retroactively.

Goal tasks left open when a week ends move to the current week. Completed tasks
stay in the week they were finished in, so past weeks keep reporting the truth.

## Project structure

```
src/
  app/             UI shell, screens and components
  application/     use cases and view models
  domain/          entities, medal rule, dates, plan revisions, backup format
  infrastructure/  IndexedDB adapter and migrations
  repositories/    storage interfaces
```

Tests live next to what they cover (`*.test.ts`) and run on Node — the domain
and application layers have no DOM dependency, and the IndexedDB adapter is
tested against `fake-indexeddb`, including upgrades from older schema
versions.

The code is intentionally prepared for future storage migration/sync while keeping V1 small and personal.


## Mobile navigation

V1 is intentionally mobile-first and has three permanent bottom sections:

- **Today** — current day with Goals, Routine and the Notes backlog
- **Progress** — progress with Week / Month / Year switch
- **Life** — Routine / Goals editor and list

## Install as PWA

Ritmo ships with a web app manifest, service worker, 192×192 and 512×512 icons, an Apple touch icon, standalone display mode and mobile safe-area support.

On Android/Chrome use **Install app / Add to Home screen**. On iPhone open Ritmo in Safari → **Share** → **Add to Home Screen**.
