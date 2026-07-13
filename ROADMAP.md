# Roadmap

Samme struktur som appen: Nå → Neste → Senere → Ferdig.
Flytt punkter oppover etter hvert som de blir gjort (se vedlikeholdsregelen i CLAUDE.md).

## Nå
- (ingenting aktivt akkurat nå — plukk neste punkt fra Neste)

## Neste
- (ingenting kø-lagt akkurat nå — plukk fra Senere eller ta noe nytt)

## Senere
- Generell polish: tilgjengelighet, ytelse.
- (Kanskje) flytte synk/innlogging fra Dexie Cloud til Supabase — plan i `SUPABASE-MIGRATION.md`. Aktuelt hvis flere brukere / lyst på Postgres.

## Ferdig
- Navigasjons-opprydding: primærflyt (Oversikt/Prosjekter/Oppgaver/Idébank) skilt fra sekundære
  støtteverktøy med en «Verktøy»-gruppe i PC-sidemenyen; Kalender demotert til «Mer». Reduserer
  «for mange moduler»-følelsen uten å fjerne noe.
- Launch-beredskap: `src/lib/launch.js` (`launchChecklist`) + sammenleggbart «Klar til lansering»-panel
  i prosjekt-info-skinnen — konkret sjekkliste (mål, steg, kontekst, repo/live-lenker, ingen åpne
  høy-steg, alt ferdig) utledet uten å endre lagrede felt.
- Reposisjonering til AI-prosjekt-cockpit: skarpere innloggings-copy + prosjekt-tomtilstand som lærer
  flyten (Idé→Prosjekt→Roadmap→Prompt-kø→Levert), ordentlig produkt-README (erstattet Vite-malen),
  `package.json` omdøpt til `fabipilot`. Avledet prosjekt-helse (`src/lib/projectHealth.js`:
  Bygger/Står stille/Klar/Levert) på kort + prosjektside, og kontekst-rike prompt-oppskrifter
  (`PROJECT_RECIPES` i `prompts.js`: brutal review, launch-sjekk, rydd koden, bug-jakt, datamodell,
  refaktor, landingstekst, vekst) som kopierer ferdige prompts med full prosjektkontekst.
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
- Backup-vane: mild påminnelse (>30 dager siden sist, maks ukentlig) som åpner backup-panelet.
- Kalender: gjentakende hendelser (daglig/ukentlig/månedlig) + gjentakende oppgaver, med ↻-merke.
- Samlet «Oppgaver»-liste — slo sammen «I dag» + «Liste» til én liste med naturlig-språk-innlegging,
  smarte dato-chips, delpunkter og sveip (fullfør/utsett).
- Universell hurtiglagring (⌘K + flytende «+») med fritekst-tolkning, pluss søk på tvers av alle moduler.
- Myk sletting + Angre overalt; erstattet `window.confirm`/`alert`/`prompt` med egne ark.
- «Hagen»: levende SVG-scene som speiler uka (vaner/prosjekter/gjort-i-dag/fokus/penger), mini-kort
  på Oversikt, trykkbar for navnelapp.
- Varsler: daglig påminnelse (Notification Triggers), «Start dagen»-rituale, app-ikon-badge.
- Omdøpt til Fabipilot; ErrorBoundary + skeletons overalt; kontrast-opprydding + mørk modus-QA;
  PWA-oppdateringsvarsel + sky-sync-status i navigasjonen.
- Ukentlig momentum: «Denne uka»-chips på prosjektsteg + søndags-«Ukeslutt»-oppsummering;
  første-gangs eksempelpakke for nye kontoer.
- Prosjekter som Claude-prompt-verksted: «kopier som prompt» (med prosjektkontekst), AI-status-pille
  (Idé→Spurt→Bygd→Verifisert), «Kjør prompts»-kø, resultat-felt på hvert steg, del prosjekt via e-post.
- Testgrunnmur: Vitest med 55 enhetstester på de mest skjøre rene funksjonene + GitHub Actions CI
  (lint+test+build på hver push/PR).
- Delte opp `Projects.jsx`/`Projects.css` (1200+/1700+ linjer) og `App.jsx` i mindre filer
  (`src/components/projects/`, `src/lib/`) for å holde monolittene under kontroll.
- Kategori-/fargeswatcher (prosjekter, hendelser, penger, vaner) samlet i én muset pastell-familie
  avledet fra aksentfargen, i stedet for en tilfeldig sammensatt jordfargepalett.
- Hagen: trykk på blomst/tre for navnelapp med vane-/prosjektnavn.
- «Handleliste»: ny delt, avhukbar handleliste — samme delings-mekanisme (Dexie Cloud-realm) som «Delt»,
  begge lister deles med samme personer via én invitasjon.
- Fiks: reelle sync-bugs i delte lister — ugyldig indeksert realm-oppslag (hindret all legg-til/inviter),
  og manglende invitasjons-godkjenning (`InviteBanner.jsx`, hindret ensidig synk).
- Delt kalender: hendelser kan merkes «Del med kjæresten», dukker opp i begges kalender.
- Rosa aksent: valgfri personlig enhets-preferanse (bytt i «Mer»/Backup), samme forhold som blå.
- «Fyll inn hele måneden» i Penger/Forbruk: totalsum per kategori i ett skjema, raskere enn enkelt-logging.
- «Pågående nå» på prosjekt-LISTEN: samlet oversikt på tvers av alle prosjekter, dra et «neste steg»-chip
  fra et prosjektkort dit for å markere det som pågående uten å måtte åpne prosjektet.
- Penger/Oversikt: «vs forrige måned»-endringsmerke på totalen og på hver kategori (kr + %, rødt/grønt),
  så du ser om forbruket økte eller falt fra måned til måned — i tillegg til den eksisterende 6-måneders
  trendgrafen og «Fyll inn hele måneden».
- «Fyll inn hele måneden»-arket har nå egen månedsvelger (‹ › + måned/år), så du kan fylle inn totaler
  for en tidligere måned uten å måtte navigere Oversikt-fanen først.
- Penger-kategoriene erstattet med brukerens faktiske bank-kategorier (Dagligvarer, Restaurant og
  uteliv, Kjøretøy, Fritid, Helse og velvære, Hjem og hage, Øvrig forbruk) — v11-migrering remapper
  gamle nøkler på eksisterende forbruk/budsjett/abonnement.
