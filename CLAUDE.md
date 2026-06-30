# Dashboard — CLAUDE.md

Slank styringsfil: kun varige regler + nåtilstand. Historikk hører hjemme i `PROGRESS.md`,
planer i `ROADMAP.md`.

## 1. Hva dette er
Et privat ADHD-vennlig alt-i-ett-dashboard for én bruker (meg). Mobil-først, PWA, lokal-først.

## 2. Hvem jeg er
Jeg er ikke koder — jeg bygger med AI. Forklar hva jeg skal lime inn og kjøre, ikke teori.
Gi meg konkrete steg. Jeg tester alltid i browser før jeg committer.

## 3. Stack
- React 19 + Vite
- UI-bibliotek: `motion` (bevegelse/sideoverganger), `lucide-react` (ikoner), `sonner` (toast),
  `recharts` (diagram, lazy-lastet med Penger). Delte primitiver i `src/lib/ui.jsx`.
- Designsystem-tokens (radius/spacing/skygge/bevegelse/typografi) i `:root` i `AppShell.css`.
- Dexie (IndexedDB) — lokal-først, fungerer offline
- Dexie Cloud (`dexie-cloud-addon`) — sync på tvers av enheter. Innlogging med e-post + engangskode.
  DB-URL er hardkodet i `db.js`. `dexie-cloud.key` er hemmelig og er i `.gitignore` (committes aldri).
  Nye web-origins (f.eks. Vercel-URL) må whitelistes: `npx dexie-cloud whitelist <url>`.
- vite-plugin-pwa
- Deploy: Vercel (auto fra `main`), ingen env-variabler

## 4. Designsystem (hold 1:1 med /prototypes)
- Bakgrunn `#E9ECE5`, kort `#FBFCF9`, blekk `#22281F`, dempet `#737B6E`, linje `#DCE0D5`
- ÉN aksentfarge: rav `#CC882B` (fokus + fullført + lagre). Sekundær: skog `#42634A`. Hold alt annet rolig.
- Fonter: Bricolage Grotesque (display), Inter (brødtekst)
- Belønning ved fullføring/lagring: gnist-animasjon + `navigator.vibrate`
- Respekter `prefers-reduced-motion`. Tap-mål min 44px. Synlig tastatur-fokus.

## 5. Produktprinsipper
- «I dag»-først.
- Maks 3 i fokus.
- Ingen skam-streaks.
- Idébanken er en meny, ikke gjeld.
- WIP-tak: maks 3 aktive prosjekter (ikke valgfritt).
- Dumme-enkelt slår smart. Ikke bygg funksjoner jeg ikke har bedt om.

## 6. Datamodell (nåtilstand — hold oppdatert)
Dexie-database `dashboard`, gjeldende schema-versjon **9**. Én store per modul. `id = crypto.randomUUID()`.
Synces via Dexie Cloud (se §3).

- **ideas** — `id, text, category, isFavorite, note, createdAt`
  (indekser: `category`, `createdAt`)
- **tasks** (I dag) — `id, title, isDone, isFocus, dueDate, completedAt, sortOrder, createdAt`
  `dueDate` = `YYYY-MM-DD`. «Henger igjen» = `dueDate` før i dag og ikke gjort.
- **habits** (Vaner) — `id, name, history[], sortOrder, createdAt`
  `history` = liste av `YYYY-MM-DD` der vanen ble gjort. Ingen streaks.
- **subscriptions** (Penger) — `id, name, amount, cycle, category, renewDay, createdAt`
  `cycle` = `'monthly' | 'yearly'`. Månedstotal: årlig deles på 12. `category` = nøkkel i `CATEGORIES` (Money.jsx).
  `renewDay` = dag i måneden (1–31) abonnementet trekkes, eller `null` (uindeksert).
- **expenses** (Penger/Forbruk) — `id, amount, category, note, date, createdAt`
  `date` = `YYYY-MM-DD`. Logget engangsforbruk. `category` = nøkkel i `CATEGORIES`.
- **budgets** (Penger/Budsjett) — `id, category, amount, createdAt`
  Én rad per kategori; `amount` = månedsbudsjett. `setBudget(cat, 0)` fjerner raden.
- **incomes** (Penger/Inntekt) — `id, name, amount, createdAt`
  Månedlig inntektskilde. Sum = «igjen å bruke» på Oversikt-fanen.
- **goals** (Penger/Sparing) — `id, name, target, saved, createdAt`
  Sparemål. `addToGoal(id, delta)` justerer `saved` (min 0).
- **projects** (Prosjekter) — `id, name, why, status, color, emoji, sortOrder, createdAt, lastTouched`
  `status` = `'active' | 'onice' | 'done'`. `lastTouched` oppdateres når et item i prosjektet endres.
  `color` = nøkkel i `PROJECT_COLORS`, `emoji` = valgt ikon (begge uindeksert, ingen schema-bump).
- **projectItems** — `id, projectId, text, stage, energy, sortOrder, createdAt`
  `stage` = `'now' | 'next' | 'later' | 'done'`. `energy` = `'lav' | 'hoy' | null`.
  «Neste steg» = første item med `stage='now'` (etter `sortOrder`). Ingen egen flagg-kolonne.
- **events** (Kalender) — `id, title, date, time, note, color, createdAt`
  `date` = `YYYY-MM-DD`. `time` = `HH:MM` eller `''`. `color` = nøkkel i `EVENT_COLORS` (Calendar.jsx).
  Kalenderen viser også `tasks` på deres `dueDate` (huk av direkte i dag-agendaen).
- **todos** (Liste) — `id, text, isDone, completedAt, dueDate, sortOrder, createdAt`
  Gjøremål med valgfri dato (`dueDate` = `YYYY-MM-DD` eller `null`, uindeksert). Manuell sortering via `sortOrder`.
- **sharedItems** (Delt) — `id, realmId, owner, text, isDone, completedAt, sortOrder, createdAt`
  Delt liste i ÉT Dexie Cloud-realm (`SHARED_REALM_NAME = 'Delt liste'`). `realmId` settes via `ensureSharedRealm()`;
  `owner` = `db.cloud.currentUserId`. Invitasjon på e-post via `inviteToShared(email)` (legger rad i `db.members`
  med `permissions:{manage:'*'}`). Bruker auto-tabellene `realms`/`members` fra dexie-cloud-addon. IKKE i JSON-eksport
  (deles via sky-realmet, ikke lokal backup).

Alle stores er med i JSON-eksport/import (se §8).

## 7. Filstruktur (nåtilstand — hold oppdatert)
- `index.html`, `vite.config.js` (PWA-manifest + ikoner), `eslint.config.js`
- `public/` — `favicon.svg`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png`, `apple-touch-icon.png`
- `src/main.jsx` — entry
- `src/App.jsx` — app-skall: navigasjon (sidemeny på PC / bunnfaner på mobil) + backup-modal + innloggings-gate
  og egendefinert Dexie Cloud auth-dialog (e-post + engangskode)
- `src/index.css` — global reset/bakgrunn
- `src/db.js` — Dexie + Dexie Cloud-config: alle stores + CRUD-hjelpere + `exportAll`/`importAll` + `promoteIdeaToProject`
- `src/lib/fx.js` — delte effekter: `burst` (gnist), `vibrate`, `fmtDate`, `autoGrow`, `kr`, `reduceMotion`
- `src/lib/ui.jsx` — premium-primitiver: `AnimatedNumber`, `Skeleton`/`SkeletonCard`, `PageTransition`,
  `Reveal`, `toast` (sonner-wrapper). Bygd på `motion`; respekterer `prefers-reduced-motion`.
- `src/lib/notify.js` — påminnelser: permission, daglig «planlegg dagen»-varsel via Notification Triggers
  (best-effort, lukket app der støttet), `fireTest`, app-ikon-badge (`setBadge`). Prefs i localStorage per enhet.
- `src/components/`
  - `MorningFlow.jsx` / `MorningFlow.css` — «Start dagen»-rituale øverst på Oversikt (én gang/dag via `ritual:<dato>`)
  - `AppShell.css` — design-tokens (`:root`-skalaer) + skall + delte komponentstiler + skeleton/toast + innloggingsskjerm + auth-dialog
  - `Overview.jsx` / `Overview.css` — «Oversikt» (startside): live kort som lenker til hver modul
  - `Today.jsx` — «I dag»
  - `TodoList.jsx` — «Liste»: gjøremål uten dato (hak av, rediger, sorter)
  - `Calendar.jsx` / `Calendar.css` — «Kalender»: månedsvisning + dag-agenda + hendelse-sheet
  - `WhatNow.jsx` — «Hva nå?»: ett forslag av gangen + energifilter + hurtiglegg-til
  - `IdeaBank.jsx` / `IdeaBank.css` — idébanken (+ «Forfremm til prosjekt»)
  - `Habits.jsx` — «Vaner» (7d/28d-oversikt)
  - `Money.jsx` / `Money.css` — «Penger»: faner Oversikt (budsjett vs forbruk per måned) / Forbruk (logget) / Faste (abonnement)
  - `Projects.jsx` / `Projects.css` — «Prosjekter»: oversikt + roadmap-side
  - `SharedList.jsx` — «Delt»: én delt liste med kjæresten (Dexie Cloud realm + e-postinvitasjon). Kun denne lista deles
  - `Search.jsx` — «Søk»: ett søkefelt på tvers av oppgaver, gjøremål, idéer, prosjekter, prosjektsteg, hendelser, vaner, forbruk, abonnement; treff lenker til modulen (via `onNav`)
- `prototypes/` — visuell fasit: `idebank.html`, `idag-prototype.html`, `roadmap-prototype.html`

## 8. Arbeidsflyt
- Sonnet til vanlig bygging/UI, Opus til logikk-floker/bugs.
- Små commits. Test i browser før commit.
- Hold JSON-eksport/import (`TABLES` i `src/db.js`) oppdatert når nye stores legges til.
- Git: jobb direkte på `main` (solo-prosjekt). Etter hver ferdig, testet endring: commit med tydelig
  melding og push til `main` med en gang. Vercel auto-deployer fra `main`, så push KUN kode som funker
  i nettleseren — aldri halvferdig eller kode som knekker bygget. Står vi midt i en floke, vent med push
  til den er løst.

## 9. Vedlikeholdsregel (følg ordrett)
> Etter hver meningsfull, testet endring:
> 1. Oppdater nåtilstand-seksjonene i CLAUDE.md BARE hvis noe varig endret seg (datamodell, filstruktur, ny modul, konvensjon).
> 2. Flytt berørte punkter i ROADMAP.md mellom Senere → Neste → Nå → Ferdig.
> 3. Legg én datert linje i PROGRESS.md: hva ble endret og hvorfor.
> 4. git add + commit med tydelig melding + push til main.
> Hold CLAUDE.md slank — historikk hører hjemme i PROGRESS.md.
