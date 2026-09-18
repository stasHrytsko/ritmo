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
- Routine scheduling by weekday
- JSON backup/export and restore/import
- Installable PWA
- Offline-first storage with IndexedDB

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

## Storage

V1 has no backend and no authentication. Data stays on the device in IndexedDB.

GitHub stores code only — never user data.

## Product rule: daily medal

For every active routine:

- scheduled today + done → satisfied
- scheduled today + not done → not satisfied
- not scheduled today → automatically satisfied

A medal is earned when all active routines are satisfied. Auto-satisfied routines do **not** create fake completion records.

## Project structure

```
src/
  app/
  application/
  domain/
  infrastructure/
  repositories/
```

The code is intentionally prepared for future storage migration/sync while keeping V1 small and personal.


## Mobile navigation

V1 is intentionally mobile-first and has three permanent bottom sections:

- **Today** — current day with Goals and Routine
- **Week** — progress with Week / Month / Year switch
- **Life** — Routine / Goals editor and list

## Install as PWA

Ritmo ships with a web app manifest, service worker, 192×192 and 512×512 icons, an Apple touch icon, standalone display mode and mobile safe-area support.

On Android/Chrome use **Install app / Add to Home screen**. On iPhone open Ritmo in Safari → **Share** → **Add to Home Screen**.
