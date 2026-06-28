# Dashboard — personlig alt-i-ett-verktøy

## Hva dette er
Et privat ADHD-vennlig dashboard for én bruker (meg). Mobil-først, PWA.
Lokal-først: all data lagres på enheten med Dexie (IndexedDB). Ingen backend, ingen innlogging.
Moduler bygges én fase om gangen: idébank → I dag → vaner → penger → prosjekter.

## Hvem jeg er
Jeg er ikke koder — jeg bygger med AI. Forklar hva jeg skal lime inn og kjøre,
ikke teori. Gi meg konkrete steg. Jeg tester alltid i browser før jeg committer.

## Stack
- React 19 + Vite
- Dexie (IndexedDB) for lokal lagring — én store per modul
- vite-plugin-pwa
- Deploy: Vercel (auto fra main), ingen env-variabler

## Data
- Hver modul = en Dexie-store. id = crypto.randomUUID().
- Alltid bygg/vedlikehold eksporter+importer (JSON) så data kan backes opp og flyttes.

## Design (hold 1:1 med prototypene i /prototypes)
- Bakgrunn salvie-grå #E9ECE5, kort #FBFCF9, blekk #22281F, dempet #737B6E
- ÉN aksentfarge: rav #CC882B (fokus + fullført + lagre). Hold alt annet rolig.
- Fonter: Bricolage Grotesque (display), Inter (brødtekst)
- Belønning ved fullføring/lagring: gnist-animasjon + navigator.vibrate
- Respekter prefers-reduced-motion. Tap-mål min 44px. Synlig tastatur-fokus.

## Prinsipper
- «I dag»-først, maks 3 i fokus, lav terskel for å fange, ingen skam-streaks.
- Dumme-enkelt slår smart. Ikke bygg funksjoner jeg ikke har bedt om.

## Arbeidsflyt
- Sonnet til vanlig, Opus til logikk-floker/bugs.
- Små commits. Forklar hva jeg skal sjekke i browser før commit.
