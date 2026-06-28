# Roadmap

Samme struktur som appen: Nå → Neste → Senere → Ferdig.
Flytt punkter oppover etter hvert som de blir gjort (se vedlikeholdsregelen i CLAUDE.md).

## Nå
- (ingenting aktivt akkurat nå — plukk neste punkt fra Neste)

## Neste
- Backup-vane: fast påminnelse/rutine for å eksportere JSON av og til (Del D i guiden).
- Små justeringer på prosjektsiden etter test (redigere «why», slette prosjekt, sortering).

## Senere
- «Hva nå?»-modul: hjelper deg velge én ting når du står fast.
- Penger: kategorier/oversikt utover ren månedstotal hvis behovet melder seg.
- Vaner: lett ukes-/månedsoversikt hvis ønskelig (fortsatt ingen skam-streaks).
- Ekte sync mellom mobil og laptop — KUN hvis jeg faktisk savner det (da: legg på en backend).
- Generell polish: tomtilstander, tilgjengelighet, ytelse.

## Ferdig
- Vite + React 19 lokal-først scaffold, `CLAUDE.md`.
- Idébank: Dexie lokal lagring, CRUD, søk, filter, gnist + vibrasjon, JSON eksport/import.
- PWA: manifest «Dashboard», ikoner (192/512 + maskable + apple-touch), service worker, offline.
- Deploy til Vercel (auto fra `main`), installerbar på hjemskjerm.
- Fullt dashboard med responsiv navigasjon: sidemeny på PC, bunnfaner på mobil.
- «I dag»: fokus (maks 3) / resten / henger igjen / fullført, fremgangsmåler, gnist ved fullføring.
- «Vaner»: daglige vaner, hak av i dag, 7-dagers prikker, ingen skam-streaks.
- «Penger»: abonnement med månedstotal (måned/år).
- «Prosjekter»: roadmap-modul — oversikt (Aktive/På is) + roadmap-side, `projects` + `projectItems`, hero «neste steg», ryggrad Nå→Neste→Senere, WIP-tak 3, «Forfremm til prosjekt» fra idébanken.
- Backup (eksport/import) dekker alle stores, samlet i app-skallet.
- Lint (ESLint fra Vite-malen) grønt; `npm run lint` satt opp.
