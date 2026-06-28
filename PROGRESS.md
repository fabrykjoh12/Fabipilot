# Progress

Append-only logg, nyeste øverst. Format: `- YYYY-MM-DD — hva ble endret og hvorfor`.

- 2026-06-28 — Ny «Kalender»-modul: månedsvisning (mandag-først), hendelser med tid/farge/notat (ny `events`-store, schema v5), oppgaver vises på forfallsdato og kan hukes av i dag-agendaen, bunn-sheet for å legge til/redigere, swipe mellom måneder. Bunn-nav gjort horisontalt scrollbar (8 moduler). Verifisert med skjermbilder.
- 2026-06-28 — La til Dexie Cloud sync med e-post-innlogging. Egendefinert auth-GUI (todelt innloggingsskjerm + norsk e-post/kode-dialog) som matcher designet i stedet for Dexies standard-GUI. `requireAuth: false` + `customLoginGui: true`.
- 2026-06-28 — La til «Oversikt» (startside med live modul-kort) og «Hva nå?» (ett forslag av gangen, energifilter, hurtiglegg-til). Penger fikk kategorier + oversikt. Rediger/slett/sorter på tvers av moduler.
- 2026-06-28 — Committet og pushet «Prosjekter»-roadmapmodulen til main (oversikt + roadmap-side, projects + projectItems, WIP-tak 3, idébank→prosjekt, utvidet eksport/import).
- 2026-06-28 — Opprettet tre-fils dokumentasjonssystem (CLAUDE.md slanket til varige regler + nåtilstand, ROADMAP.md, PROGRESS.md) for å holde styring og historikk adskilt.
- 2026-06-28 — Bygde «Prosjekter» som roadmap-modul (nye stores `projects` + `projectItems`, hero «neste steg», ryggrad Nå→Neste→Senere, WIP-tak på 3 aktive, «Forfremm til prosjekt» fra idébanken). Migrerte gamle prosjekter til nytt schema. Ukommittert til browser-test er gjort.
- 2026-06-28 — Utvidet fra én skjerm til fullt dashboard: app-skall med responsiv navigasjon (sidemeny på PC, bunnfaner på mobil) + modulene «I dag», «Vaner» og «Penger». Backup utvidet til å dekke alle stores.
- 2026-06-28 — Bygde idébanken (Dexie lokal lagring, CRUD, søk/filter, gnist + vibrasjon, JSON eksport/import), satte opp PWA og deployet til Vercel.
