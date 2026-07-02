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
- Designsystem-tokens (radius/spacing/skygge/bevegelse/typografi/farger) i `:root` i `AppShell.css`.
- Fonter er selv-hostet via `@fontsource-variable/plus-jakarta-sans` (importert i `main.jsx`) — ingen
  Google Fonts-CDN (proxy blokkerer den + fungerer offline i PWA).
- Dexie (IndexedDB) — lokal-først, fungerer offline
- Dexie Cloud (`dexie-cloud-addon`) — sync på tvers av enheter. Innlogging med e-post + engangskode.
  DB-URL er hardkodet i `db.js`. `dexie-cloud.key` er hemmelig og er i `.gitignore` (committes aldri).
  Nye web-origins (f.eks. Vercel-URL) må whitelistes: `npx dexie-cloud whitelist <url>`.
- vite-plugin-pwa
- Vitest for enhetstester på rene funksjoner (`src/lib/*.test.js`). GitHub Actions (`.github/workflows/ci.yml`)
  kjører lint + test + build på push/PR.
- Deploy: Vercel (auto fra `main`), ingen env-variabler

## 4. Designsystem (Any.do-inspirert — rent, lyst, luftig)
- Lys palett: lerret `#ffffff`, kort `#ffffff`/dempet flate `#f6f7f9`, blekk `#1a1c22`, dempet `#8b909c`,
  linje `#ecedf1` / sterk linje `#dfe1e7`. Mørk modus = grafitt (`--canvas:#0f1116` osv.). Alle verdier er
  CSS-tokens i `:root` — bruk `var(--…)`, aldri hardkodede hex i komponenter.
- Aksent = blå `#2f6dff` (fokus, primær-CTA, valgt, lenker, interaktivt). Semantisk grønn `#16a37b`
  (`--forest`) kun for positiv status (aktivt prosjekt, vane gjort). Kategori-farger (prosjekt/hendelse/
  penger/vaner) er egne valgbare swatcher fra `SWATCH` (`src/lib/palette.js`) — en muset pastell-familie
  avledet fra aksenten (samme metning/lyshet, ulik fargetone), ikke direkte bundet til aksentfargen.
- Layout: rene rader med tynn skillelinje (ikke tunge kort) der lista er primær (Oppgaver); luftige hvite
  kort ellers. Seksjonsetiketter = rolig grå majuskel, ingen bokser.
- Fonter: Plus Jakarta Sans (variabel) for både display og brødtekst, via tokens `--font-display`/`--font-body`.
- Belønning ved fullføring/lagring: gnist-animasjon + `navigator.vibrate`
- Respekter `prefers-reduced-motion`. Tap-mål min 44px. Synlig tastatur-fokus.

## 5. Produktprinsipper
- «I dag»-først.
- Maks 3 i fokus.
- Ingen skam-streaks.
- Idébanken er en meny, ikke gjeld.
- Ingen WIP-tak på prosjekter — de er Claude-prompt-verksteder, så du kan ha så mange aktive du vil.
  («på is» finnes fortsatt som en manuell status). Fokus-taket (maks 3) gjelder fortsatt for oppgaver.
- Dumme-enkelt slår smart. Ikke bygg funksjoner jeg ikke har bedt om.

## 6. Datamodell (nåtilstand — hold oppdatert)
Dexie-database `dashboard`, gjeldende schema-versjon **10**. Én store per modul. `id = crypto.randomUUID()`.
Synces via Dexie Cloud (se §3).

- **ideas** — `id, text, category, isFavorite, note, createdAt`
  (indekser: `category`, `createdAt`)
- **tasks** (Oppgaver — den samlede lista) — `id, title, isDone, isFocus, dueDate, completedAt, estimate, repeat, subtasks[], sortOrder, createdAt`
  `dueDate` = `YYYY-MM-DD` ELLER `null` (udatert → «Når som helst»). «Henger igjen» = `dueDate` før i dag og ikke gjort.
  `subtasks` = `[{id,text,done}]`. Seksjoner styres av `isDone`/`isFocus`/`dueDate` (datoen nullstilles ikke ved fullføring).
  v10 slo sammen den gamle `todos`-lista inn her (samme id-er, idempotent).
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
  `color` = nøkkel i `PROJECT_COLORS`, `emoji` = valgt ikon. Prompt-verksted-felt (alle uindeksert, ingen
  schema-bump): `context` (Claude-kontekst/stack — limes inn foran kopierte prompts), `liveUrl`, `repoUrl`,
  `deadline` (`YYYY-MM-DD` el. `null`), `notes`. Deling: `shareProject(id,email)` flytter prosjektet + alle
  `projectItems` inn i et eget Dexie Cloud-realm (`realmId`) og inviterer på e-post; `stopSharingProject`
  flytter tilbake til privat realm. `addProjectItem` arver prosjektets `realmId`.
- **projectItems** — `id, projectId, text, stage, energy, sortOrder, createdAt`
  `stage` = `'now' | 'next' | 'later' | 'done'` (prioritet Høy/Medium/Lav på PC-tavla). `energy` = `'lav' | 'hoy' | null`.
  `aiStatus` = `'idea' | 'asked' | 'built' | 'verified'` (Claude-loop, uindeksert; default `'idea'`), `subtasks[]`.
  `wip` = `true` når steget er «pågående» (vises i egen full-bredde-lane øverst på tavla, ut av prioritetskolonnen; uindeksert).
  `result` = fritekst/lenke med hva Claude svarte (uindeksert; redigeres i utvidet kort + kø-modus, søkbar via ⌘K).
  `doneAt` = ms-tidsstempel når steget ble fullført (settes av `setItemStage`/`moveItemToStage`; brukes av «Denne uka»).
  «Neste steg» = første item med `stage='now'` (etter `sortOrder`). Ingen egen flagg-kolonne.
- **events** (Kalender) — `id, title, date, time, note, color, createdAt`
  `date` = `YYYY-MM-DD`. `time` = `HH:MM` eller `''`. `color` = nøkkel i `EVENT_COLORS` (Calendar.jsx).
  Kalenderen viser også `tasks` på deres `dueDate` (huk av direkte i dag-agendaen).
- **todos** (UTGÅTT) — slått sammen inn i `tasks` i v10. Storen beholdes tom for bakoverkompat;
  `importAll` mapper gamle backup-`todos` automatisk inn i `tasks`. Ikke i bruk i UI.
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
- `src/App.jsx` — app-skall: navigasjon (sidemeny på PC / bunnfaner på mobil), innloggings-gate, moduler
- `src/components/Login.jsx` — innloggingsskjerm + egendefinert Dexie Cloud auth-dialog (e-post + engangskode)
- `src/components/BackupSheet.jsx` — sky-sync & backup-panelet (tema, daglig påminnelse, sync-diagnostikk, JSON-eksport/import)
- `src/components/NavIcon.jsx` — nav-ikon-komponent (deles av App-navigasjonen og Login); ikonkartet ligger i `src/lib/icons.js`
- `src/lib/icons.js` — `ICONS`-kartet (modul → Lucide-ikon)
- `src/lib/sync.js` — `syncLabel`/`syncLed`: sky-sync-status → norsk etikett/farge-LED (delt av nav og BackupSheet)
- `src/lib/palette.js` — `SWATCH`: muset pastell-fargefamilie avledet fra aksenten (samme HSL S/L,
  ulik hue). Delt av `PROJECT_COLORS` (projects/shared.jsx), `EVENT_COLORS` (Calendar.jsx), `CATEGORIES`
  (Money.jsx), `HABIT_COLORS` (Habits.jsx) og Hagens `habitHex` (Garden.jsx) — kun fargeverdier, nøklene
  (`k`) som lagres i databasen er uendret
- `src/index.css` — global reset/bakgrunn
- `src/db.js` — Dexie + Dexie Cloud-config: alle stores + CRUD-hjelpere + `exportAll`/`importAll` + `promoteIdeaToProject`
  (re-eksporterer `todayKey`/`tomorrowKey`/`nextDate` fra `lib/dates.js` så kall-steder er uendret)
- `src/lib/dates.js` — rene datohjelpere: `todayKey`, `tomorrowKey`, `nextDate` (testet i `dates.test.js`)
- `src/lib/migrations.js` — rene migrerings-mappinger: `legacyTodoToTask` (delt av v10-migreringen og
  `importAll`s eldre-backup-gren; testet i `migrations.test.js`)
- `src/lib/prompts.js` — Claude-prompt-bygging: `projectContext`, `buildPrompt`, `buildAllPrompts`, `hasContext`
  (brukt av Prosjekter; testet i `prompts.test.js`)
- `src/lib/fx.js` — delte effekter: `burst` (gnist), `vibrate`, `fmtDate`, `autoGrow`, `kr`, `reduceMotion`
- `src/lib/ui.jsx` — premium-primitiver: `AnimatedNumber`, `Skeleton`/`SkeletonCard`/`ScreenSkeleton`, `PageTransition`,
  `Reveal`, `toast` (sonner-wrapper), `useEscape` (lukk ark/dialoger på Escape). Bygd på `motion`; respekterer
  `prefers-reduced-motion`.
- `src/lib/search.jsx` — søkeindeks på tvers av modulene (`useSearchIndex`, `SEARCH_TYPES`, `Highlight`),
  brukt av ⌘K-paletten i `Capture.jsx`
- `src/lib/notify.js` — påminnelser: permission, daglig «planlegg dagen»-varsel via Notification Triggers
  (best-effort, lukket app der støttet), `fireTest`, app-ikon-badge (`setBadge`). Prefs i localStorage per enhet.
- `src/lib/parse.js` — `parseEntry(text)`: tolker norsk dato/tid + typehint for hurtiglagring → `{title, type, dueDate, time}`
  (testet i `parse.test.js`)
- `src/components/ErrorBoundary.jsx` — fanger renderfeil (rot + rundt aktiv modul): rolig fallback med
  Prøv igjen + Last ned backup i stedet for hvit skjerm
- `src/components/`
  - `Capture.jsx` / `Capture.css` — universell hurtiglagring (⌘K + flytende «+»): tolker fritekst og ruter til riktig modul
  - `MorningFlow.jsx` / `MorningFlow.css` — «Start dagen»-rituale øverst på Oversikt (én gang/dag via `ritual:<dato>`)
  - `AppShell.css` — design-tokens (`:root`-skalaer) + skall + delte komponentstiler + skeleton/toast + innloggingsskjerm + auth-dialog
  - `Overview.jsx` / `Overview.css` — «Oversikt» (startside): live kort som lenker til hver modul
  - `Tasks.jsx` / `Tasks.css` — «Oppgaver»: ÉN samlet liste (erstatter «I dag» + «Liste»). Seksjoner Fokus/I dag/Henger igjen/Kommende/Når som helst/Fullført, naturlig-språk-innlegging (`parseEntry`), smarte dato-chips, delpunkter, sveip (fullfør/utsett), fokus maks 3
  - `Calendar.jsx` / `Calendar.css` — «Kalender»: månedsvisning + dag-agenda + hendelse-sheet
  - `WhatNow.jsx` — «Hva nå?»: ett forslag av gangen + energifilter + hurtiglegg-til
  - `IdeaBank.jsx` / `IdeaBank.css` — idébanken (+ «Forfremm til prosjekt»)
  - `Habits.jsx` — «Vaner» (7d/28d-oversikt)
  - `Money.jsx` / `Money.css` — «Penger»: faner Oversikt (budsjett vs forbruk per måned) / Forbruk (logget) / Faste (abonnement)
  - `Projects.jsx` — «Prosjekter»: tynn ruter (liste ↔ arbeidsbenk). Selve komponentene bor i
    `src/components/projects/`: `shared.jsx` (konstanter/ikoner, ingen state), `ProjectsList.jsx`
    (kort-rutenett på PC), `Roadmap.jsx` (prosjektside — Claude-prompt-verksted; PC = to-spalte
    arbeidsbenk: info-skinne (hvorfor, lenker, Claude-kontekst, fremdrift, statistikk) + kanban-tavle
    Høy/Medium/Lav), `SpineCard.jsx` (ett steg — energi, delpunkter, resultat, AI-status-pille,
    dra-håndtak), `WipLane.jsx` («Pågående»-lane øverst), `StageBlock.jsx` (én prioritetskolonne),
    `StepSheet.jsx` (handlings-ark for ett steg), `PromptQueue.jsx` («Kjør prompts»-kø: én prompt om
    gangen → kopier/åpne Claude → neste, med «Lim inn resultat»), `PromptComposer.jsx` (mal-basert
    prompt-bygger), `ShareSheet.jsx` (del prosjekt via e-post). CSS delt tilsvarende i samme mappe
    (`list.css`, `roadmap.css`, `workspace.css`, `prompts.css`, `composer.css`, `wip-result.css`),
    importert i original rekkefølge for uendret cascade. «Kopier som prompt» limer prosjektkontekst
    foran via `buildPrompt` (`src/lib/prompts.js`)
  - `SharedList.jsx` — «Delt»: én delt liste med kjæresten (Dexie Cloud realm + e-postinvitasjon). Kun denne lista deles
  - `Search.jsx` — «Søk»: ett søkefelt på tvers av oppgaver, gjøremål, idéer, prosjekter, prosjektsteg, hendelser, vaner, forbruk, abonnement; treff lenker til modulen (via `onNav`)
  - `Garden.jsx` / `Garden.css` — «Hage»: rolig, levende SVG-scene som speiler uka (vaner=blomster, prosjekter=trær, gjort i dag=sommerfugler, fokus=sol, penger=vær). Kun lesing over eksisterende stores, ingen skam/visning
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
