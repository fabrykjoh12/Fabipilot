# Roadmap

Samme struktur som appen: Nå → Neste → Senere → Ferdig.
Flytt punkter oppover etter hvert som de blir gjort (se vedlikeholdsregelen i CLAUDE.md).

## Nå
- (ingenting aktivt akkurat nå — plukk neste punkt fra Neste)

## Neste
- Backup-vane: fast påminnelse/rutine for å eksportere JSON av og til (Del D i guiden).
- Kalender: gjentakende hendelser + ev. påminnelser hvis behovet melder seg.

## Senere
- Generell polish: tilgjengelighet, ytelse.
- (Kanskje) flytte synk/innlogging fra Dexie Cloud til Supabase — plan i `SUPABASE-MIGRATION.md`. Aktuelt hvis flere brukere / lyst på Postgres.

## Ferdig
- Vite + React 19 lokal-først scaffold, `CLAUDE.md`.
- Idébank: Dexie lokal lagring, CRUD, søk, filter, gnist + vibrasjon, JSON eksport/import.
- PWA: manifest «Dashboard», ikoner (192/512 + maskable + apple-touch), service worker, offline.
- Deploy til Vercel (auto fra `main`), installerbar på hjemskjerm.
- Fullt dashboard med responsiv navigasjon: sidemeny på PC, bunnfaner på mobil.
- «I dag»: fokus (maks 3) / resten / henger igjen / fullført, fremgangsmåler, gnist ved fullføring.
- «Vaner»: daglige vaner, hak av i dag, 7d/28d-prikker, sortering, ingen skam-streaks.
- «Penger»: abonnement med månedstotal (måned/år) + kategorier med oversikt.
- «Prosjekter»: roadmap-modul — oversikt (Aktive/På is) + roadmap-side, `projects` + `projectItems`, hero «neste steg», ryggrad Nå→Neste→Senere, WIP-tak 3, «Forfremm til prosjekt», rediger/slett/sorter.
- «Oversikt»: startside med live kort som lenker til hver modul.
- «Hva nå?»: ett forslag av gangen (oppgaver/vaner/prosjektsteg), energifilter, hurtiglegg-til.
- «Kalender»: månedsvisning, hendelser (tid + farge + notat), oppgaver på forfallsdato, dag-agenda, hendelse-sheet.
- Sync mellom enheter: Dexie Cloud med e-post-innlogging, egendefinert auth-GUI som matcher designet.
- Backup (eksport/import) dekker alle stores, samlet i app-skallet.
- Lint (ESLint fra Vite-malen) grønt; `npm run lint` satt opp.
