# Notat: flytte fra Dexie Cloud til Supabase

Status: **planlegging, ikke påbegynt.** Dette er et arbeidsnotat for den dagen du
eventuelt vil bytte synk-/innlogging-backend fra Dexie Cloud til Supabase. Appen
funker helt fint på Dexie Cloud i dag — dette er kun en «hvis/når»-plan.

## 0. TL;DR
- **Mulig? Ja.** **Gratis/enkelt? Nei** — regn med noen dager. ~80 % av jobben er
  synk + deling, ikke selve dataene.
- **Du er ikke innelåst:** all data kan eksporteres til JSON i dag (`exportAll`), og
  nesten all datalogikk går gjennom hjelpere i `src/db.js`. Holder vi de funksjonene
  like på utsiden, endres komponentene knapt.
- **Hovedutfordringen:** Dexie Cloud gir offline-først synk + konfliktløsning + deling
  (realms) «gratis». Supabase er en server-database — det laget må vi bygge/erstatte.
- **Grunn til å bytte:** flere brukere (Supabase Auth er gratis for titusenvis mot
  Dexie sine 3 faste), lyst på Postgres/SQL, mer kontroll.
- **Anbefalt vei hvis vi bytter:** behold Dexie lokalt, legg en synk-motor
  (**PowerSync** eller **ElectricSQL**) mot Supabase — bevarer offline uten å skrive
  synk fra bunnen.

---

## 1. Dagens arkitektur
To lag:
- **Dexie (IndexedDB)** — lokal lagring på enheten. Grunnen til at appen er lynrask
  og funker offline (PWA). *Dette beholder vi helst.*
- **Dexie Cloud** (`dexie-cloud-addon`) — synk mellom enheter + innlogging (e-post +
  engangskode) + deling via «realms». *Dette er det Supabase skal erstatte.*

Konfig: `src/db.js` → `db.cloud.configure({ databaseUrl, requireAuth:false, customLoginGui:true })`.
Innlogging-GUI: `src/App.jsx` (`LoginScreen`/`LoginInteraction`, drevet av
`db.cloud.userInteraction` / `db.cloud.currentUser`). Gate: `if (!isLoggedIn) return <LoginScreen/>`.

Alt av datalogikk ligger bak hjelpere i `src/db.js` (~90 eksporterte funksjoner:
`addTask`, `addProjectItem`, `shareProject`, …). Komponentene kaller disse, ikke
Dexie direkte (med noen få unntak som bruker `db.table(...)`/`useLiveQuery`).

---

## 2. Målarkitektur (Supabase)
- **Postgres** som kilde-database (én rad-per-post, JSONB for nøstede felt).
- **Supabase Auth** for innlogging (e-post magic link / OTP — samme følelse som i dag).
- **Row-Level Security (RLS)** for at hver bruker kun ser egne + delte rader.
- **Realtime** (Postgres-endringer → klient) for live-oppdatering, ELLER en synk-motor
  som håndterer offline (se §5).

---

## 3. Skjema-mapping (Dexie-store → Postgres-tabell)
Felles for alle tabeller: `id uuid primary key`, `user_id uuid not null` (eier, for RLS),
`created_at timestamptz default now()`, `updated_at timestamptz` (for konfliktløsning).
Nøstede lister (`subtasks`, `history`) legges enklest som **JSONB** — matcher dagens
form og gir minst migreringsjobb (kan normaliseres til barnetabeller senere).

| Dexie-store    | Postgres-tabell   | Spesielle kolonner (utover id/user_id/created_at/updated_at)                                   |
|----------------|-------------------|-----------------------------------------------------------------------------------------------|
| `ideas`        | `ideas`           | `text, category, is_favorite bool, note`                                                       |
| `tasks`        | `tasks`           | `title, is_done, is_focus, due_date date, completed_at, estimate int, repeat, subtasks jsonb, sort_order` |
| `habits`       | `habits`          | `name, history jsonb (liste av YYYY-MM-DD), sort_order`                                        |
| `subscriptions`| `subscriptions`   | `name, amount numeric, cycle, category, renew_day int`                                         |
| `expenses`     | `expenses`        | `amount numeric, category, note, date date`                                                    |
| `budgets`      | `budgets`         | `category, amount numeric` (unik per user_id+category)                                          |
| `incomes`      | `incomes`         | `name, amount numeric`                                                                          |
| `goals`        | `goals`           | `name, target numeric, saved numeric`                                                           |
| `projects`     | `projects`        | `name, why, status, color, emoji, sort_order, last_touched, context, live_url, repo_url, deadline date, notes` |
| `projectItems` | `project_items`   | `project_id uuid → projects, text, stage, energy, ai_status, subtasks jsonb, sort_order`       |
| `events`       | `events`          | `title, date date, time, note, color`                                                          |
| `sharedItems`  | `shared_items`    | `text, is_done, completed_at, sort_order` (+ deling, se §6)                                     |
| `todos`        | —                 | utgått/tom, dropp den                                                                           |

`realms` / `members` (Dexie Cloud auto-tabeller) → erstattes av delings-modell i §6.

---

## 4. Innlogging (Auth)
- Bytt `db.cloud.login()` / `db.cloud.currentUser` / `userInteraction` →
  `supabase.auth.signInWithOtp({ email })` + `supabase.auth.getUser()` +
  `supabase.auth.onAuthStateChange(...)`.
- `App.jsx`-gaten (`if (!isLoggedIn) return <LoginScreen/>`) beholdes; bare kilden til
  `isLoggedIn`/`currentUser` byttes. Den egendefinerte e-post+kode-dialogen kan gjenbrukes
  nesten som den er (Supabase OTP er også e-post + 6-sifret kode).

---

## 5. Synk-laget (hovedjobben) — tre veier
1. **Egen synk (behold Dexie lokalt).** Skriv fortsatt til Dexie i `db.js`, men legg på:
   en `mutations`-logg, push til Supabase, pull med `updated_at`-filter, last-write-wins.
   Mest tro mot i dag, mest kode, mest fallgruver (konflikter, sletting, rekkefølge).
2. **Synk-motor: PowerSync eller ElectricSQL (anbefalt).** Begge gir «lokal-først på toppen
   av Postgres/Supabase». Du definerer hvilke tabeller/rader som synces; motoren håndterer
   offline-kø, konflikter og realtime. Mindre egen kode. Merk: noen oppsett bytter lokal
   Dexie/IndexedDB mot SQLite (wa-sqlite) — da må `db.js`-spørringene skrives om deretter.
3. **Online-først med bare `supabase-js`.** Dropp Dexie, bruk Supabase direkte + Realtime.
   Enklest mentalt, men **mister offline/lokal-først** — bryter et kjerneprinsipp (CLAUDE.md §1).
   Kun aktuelt hvis offline ikke lenger betyr noe.

---

## 6. Deling (realms/members → RLS)
Dagens deling: `shareProject(id,email)` flytter prosjekt + `projectItems` inn i et Dexie
Cloud-realm og inviterer på e-post; delt liste bruker ett fast realm.

Supabase-erstatning:
- Ny tabell `shares(id, resource_type text ['project'|'shared_list'], resource_id uuid,
  owner_id uuid, invited_email text, invited_user_id uuid null, permission text, created_at)`.
- **RLS-policy** (eksempel for `projects`): en rad er synlig hvis
  `user_id = auth.uid()` **ELLER** det finnes en `shares`-rad der `resource_type='project'
  AND resource_id = projects.id AND invited_user_id = auth.uid()`. Samme mønster for
  `project_items` (via `project_id`) og `shared_items`.
- Invitasjon på e-post: sett `invited_email`; koble `invited_user_id` når personen logger
  inn med den e-posten (trigger/Edge Function, eller ved innlogging).
- `shareProject`/`listProjectMembers`/`removeProjectMember`/`stopSharingProject` skrives om
  mot `shares`-tabellen i stedet for `db.realms`/`db.members`. UI (`ShareSheet`) kan stå ~likt.
- Bonus: da slipper vi «flytt rader mellom realms»-dansen — deling blir bare rader i `shares`.

---

## 7. Hva i `src/db.js` må endres (kategorisert)
- **Uendret:** rene hjelpere uten DB (`todayKey`, `tomorrowKey`, `nextDate`, `monthlyCost`).
- **Beholdes for migrering:** `exportAll` / `importAll` / `TABLES` (bruk til engangs-dataflytt).
- **CRUD-hjelpere** (`add*`, `update*`, `delete*`, `list*`, `toggle*`, `set*`, `move*`,
  `reorder*`, `swap*`): 
  - Vei 1/2 (Dexie beholdes lokalt): stort sett **uendret** — synk-motoren tar resten.
  - Vei 3 (online-først): **skrives om** til `supabase.from('...')`-kall.
- **Auth:** `db.cloud.*` → `supabase.auth.*` (påvirker `App.jsx` mest).
- **Deling:** `shareProject`, `listProjectMembers`, `removeProjectMember`,
  `stopSharingProject`, `ensureSharedRealm`, `inviteToShared`, `listSharedMembers`,
  `addSharedItem` (+ `realmId`-arv i `addProjectItem`) → mot `shares` + RLS (§6).
- **Reaktivitet:** `useLiveQuery` (Dexie) — beholdes hvis Dexie er lokalt lag; erstattes av
  Supabase Realtime-abonnement/`useQuery` hvis online-først.

---

## 8. Dataflytt (engangs)
1. I appen i dag: **eksporter JSON** (backup-modalen, `exportAll`).
2. Skriv et lite migreringsskript (Node) som leser JSON og `insert`-er i Supabase-tabellene
   med feltmapping (camelCase → snake_case, `dueDate`→`due_date`, sett `user_id`).
3. Verifiser antall rader per tabell. Dataene er trivielle å flytte — det er koden/synken
   som er jobben.

---

## 9. Foreslått rekkefølge (faser)
1. **PoC på én modul** (f.eks. bare `tasks`): Supabase-prosjekt + `tasks`-tabell + RLS +
   Auth + valgt synk-vei. Bevis at offline→online funker for én modul.
2. **Auth + gate** over på Supabase (behold resten på Dexie Cloud midlertidig hvis mulig,
   ellers full veksling).
3. **Resten av tabellene** + RLS.
4. **Deling** (`shares` + policies + skriv om `shareProject` m.fl.).
5. **Dataflytt** (JSON → Supabase) + verifisering.
6. **Rydd bort** `dexie-cloud-addon` og cloud-konfig; oppdater CLAUDE.md §3/§6.

---

## 10. Innsats & risiko
- **Grovt anslag:** 2–5 dager avhengig av synk-vei (vei 2 raskest, vei 1 tregest/mest risiko).
- **Størst risiko:** offline-synk og konfliktløsning (derfor anbefales PowerSync/ElectricSQL
  framfor egen synk), og korrekt RLS for deling (test at delt bruker *bare* ser det delte).
- **Lav risiko:** selve dataflyttingen (JSON-eksport finnes allerede).
- **Ikke-bytt-argument:** Dexie Cloud gir offline + synk + deling nesten gratis; på Supabase
  er nettopp det den delen du selv må bygge.

---

## 11. Kilder / verktøy å slå opp når vi starter
- Supabase Auth (OTP/magic link), Row-Level Security policies.
- PowerSync (local-first for Postgres/Supabase) eller ElectricSQL — velg synk-motor i fase 1.
- Behold `exportAll`/`importAll` som sikkerhetsnett før og etter flytt.
