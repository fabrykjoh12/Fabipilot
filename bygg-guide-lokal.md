# Byggeguide (v2) — lokal-først, ingen Supabase

Alt du skal gjøre, i rekkefølge, for å gjøre prototypene til en ekte app på hjemskjermen.
Stack: **React 19 + Vite**, data lagret **på enheten** (IndexedDB via Dexie), deployet som **PWA**.

## Strategien (les først)

- **Én bruker = du.** Ingen database i skyen, ingen innlogging, ingen prosjekt-plasser. Data ligger på enheten.
- **Idébanken først.** Den er ferdig designet og enkel — du får en deployet, fungerende app raskt og lærer hele flyten.
- **Deploy mens den er liten.** Få den på hjemskjermen før du bygger mer.
- **Gjenbruk prototypen.** Claude Code skal *porte* HTML-fila til React, ikke designe på nytt.
- **Backup = trygghet.** Vi bygger inn eksporter/importer (JSON) fra dag 1, så data aldri er innelåst eller kan gå tapt.

Loopen er den kjente: planlegg i nettleser-Claude → bygg i Claude Code → test i browser → commit → neste.

---

## DEL A — Sett opp prosjektet

**1. Lag prosjektet** (i terminalen):
```bash
npm create vite@latest dashboard -- --template react
cd dashboard
npm install
npm install dexie
npm install -D vite-plugin-pwa
```

**2. Legg prototypene inn som «fasit».** Lag mappa `prototypes/` og legg `idebank.html` og `idag-prototype.html` der. Claude Code bruker dem som visuell sannhet.

**3. Lag `CLAUDE.md`** i rota (innhold nederst — bare lim inn).

**4. Git + GitHub** (som med Hanzi-dojo):
```bash
git init
git add .
git commit -m "Init: Vite + React lokal-først scaffold"
```
Lag nytt repo på GitHub (f.eks. `fabrykjoh12/dashboard`), så:
```bash
git remote add origin https://github.com/fabrykjoh12/dashboard.git
git branch -M main
git push -u origin main
```

Ingen `.env`, ingen nøkler, ingenting å holde hemmelig. 🎉

---

## DEL B — Bygg idébanken (lokal-først)

**5. Åpne Claude Code i `dashboard`-mappa.** Gi den denne prompten:

> Les `prototypes/idebank.html` og `CLAUDE.md`. Port idébanken til en React-komponent som lagrer data lokalt på enheten med Dexie (IndexedDB).
> - Behold designet 1:1 (farger, fonter, animasjoner, layout, den norske teksten, gnist + vibrasjon).
> - Sett opp Dexie i `src/db.js` med en `ideas`-store: felter `id` (uuid via crypto.randomUUID), `text`, `category`, `isFavorite`, `note`, `createdAt`. Indekser på `category` og `createdAt`.
> - CRUD: hente (nyeste først), legge til, redigere tekst/notat, sette kategori, toggle favoritt, slette.
> - Legg til **eksporter** (last ned alle ideer som `idebank-backup.json`) og **importer** (les en JSON-fil og legg inn). Plasser dem diskret, f.eks. bak en liten meny øverst.
> - Ingen innlogging, ingen backend. Bruk Sonnet. Forklar hva jeg skal kjøre og hva jeg skal sjekke i browseren før jeg committer.

**6. Test-loopen.** Kjør `npm run dev`, åpne i nettleseren:
- Legg til en idé → **last siden på nytt** → er den fortsatt der? Da lagres den lokalt. ✅
- Eksporter → får du en JSON-fil? Importer den i et nytt nettleservindu → kommer ideene inn? ✅
- Funker det → `git commit` + `git push`. Stopper noe → lim feilmeldingen til Claude Code (bytt til Opus hvis det er en floke).

---

## DEL C — Gjør det til en app på mobilen

**7. PWA.** Be Claude Code:
> Sett opp `vite-plugin-pwa` i `vite.config.js`. Manifest: navn «Dashboard», kort navn «Dashboard», temafarge `#CC882B`, bakgrunn `#E9ECE5`, display standalone. Lag enkle app-ikoner (192 + 512 px) i samme rolige stil. Sørg for at appen kan installeres på hjemskjerm og funker offline.

**8. Deploy til Vercel** (gratis, og enda enklere uten backend):
- vercel.com → New Project → importer GitHub-repoet → Deploy.
- Ingen env-variabler å sette opp denne gangen.
- Hver `git push` til `main` oppdaterer appen automatisk.

**9. Legg på hjemskjerm.** Åpne Vercel-URL-en på mobilen → Del → «Legg til på Hjem-skjerm». Nå ligger den som et ikon ved siden av de andre appene. Dette steget er det som gjør at du faktisk åpner den — og det gjør også at iOS holder bedre på de lokale dataene.

---

## DEL D — Backup-vanen (viktig med lokal lagring)

Siden data ligger på enheten, ikke i skyen:
- **Trykk eksporter av og til** (f.eks. en gang i uka) og lagre JSON-fila i iCloud/Google Drive/Dropbox.
- Da kan du flytte data til laptop, eller hente alt tilbake hvis du bytter telefon eller tømmer nettleseren.
- Dette er din «sync» og «backup» i ett, helt gratis, helt i din kontroll.

---

## DEL E — Vokse videre

**10. Neste funksjon: «I dag».** Samme loop. Prompt:
> Les `prototypes/idag-prototype.html`. Lag «I dag»-skjermen som React-komponent, design 1:1, med en `tasks`-store i Dexie (`id`, `title`, `isDone`, `isFocus`, `dueDate`, `completedAt`, `sortOrder`, `createdAt`). «Henger igjen» = oppgaver med `dueDate` før i dag som ikke er gjort. Legg den som egen fane ved siden av idébanken. Utvid eksport/import til å ta med oppgaver også.

Deretter resten fra idébank-dokumentet: vaner → «Hva nå?» → abonnement/penger → prosjekter. Én fase om gangen, test og deploy mellom hver.

**11. Modell-bytte.** Sonnet til vanlig bygging og UI. Opp til Opus når noe er en logikk-floke eller en bug du har stått fast på mer enn ett forsøk.

**12. Hvis du senere vil ha ekte sync mellom mobil og laptop:** da — og bare da — legger vi på en backend (pause et Supabase-prosjekt for å frigjøre en plass, eller bruk noe gratis som Firebase). Ikke før du faktisk savner det.

---

## Vedlegg: `CLAUDE.md` (lim inn i rota)

```markdown
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
```
