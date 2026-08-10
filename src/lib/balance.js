/* Saldo og pengeflyt — «hvor mye har jeg?» og «hva gikk inn og ut?».

   Appen visste før bare hva du BRUKTE. Den kunne ikke svare på hva du HAR.
   Løsningen er billig: du oppgir saldoen din én gang (et «holdepunkt»), så
   ruller appen den framover med importerte inn- og utbetalinger.

   Et nytt holdepunkt når som helst overstyrer alt før det — det er fasiten fra
   banken, og retter opp eventuelt avvik uten at noe må slettes.

   Rene funksjoner; ingenting utledet lagres. */

/* Saldoen ved slutten av `dateIso`.

   snapshots: [{date, amount}] — saldo ved SLUTTEN av den datoen
   inflows:   [{date, amount}] — alt inn (også overføringer; de øker jo kontoen)
   expenses:  [{date, amount}] — alt ut

   Returnerer null når det ikke finnes noe holdepunkt på eller før datoen —
   da VET vi ikke saldoen, og skal ikke gjette. */
export function balanceAt(snapshots, inflows, expenses, dateIso) {
  const anchor = latestSnapshot(snapshots, dateIso)
  if (!anchor) return null

  const after = (r) => r && r.date > anchor.date && r.date <= dateIso && Number(r.amount) > 0
  const inSum = (inflows || []).filter(after).reduce((s, r) => s + Number(r.amount), 0)
  const outSum = (expenses || []).filter(after).reduce((s, r) => s + Number(r.amount), 0)

  return {
    balance: Number(anchor.amount) + inSum - outSum,
    anchor,
    inSince: inSum,
    outSince: outSum,
    // true når saldoen er ren avlesning uten bevegelser oppå
    exact: inSum === 0 && outSum === 0,
  }
}

/** Siste holdepunkt på eller før `dateIso`. */
export function latestSnapshot(snapshots, dateIso) {
  const valid = (snapshots || [])
    .filter((s) => s && s.date && (!dateIso || s.date <= dateIso))
    .sort((a, b) => a.date.localeCompare(b.date))
  return valid.length ? valid[valid.length - 1] : null
}

/* Inn og ut for én måned ("2026-08").

   `inntekt` holdes bevisst adskilt fra `overforing`: penger flyttet fra en
   annen egen konto øker saldoen, men er ikke tjent. Blandes de sammen, ser en
   vanlig måned ut som om du tjente titusener du ikke tjente. */
export function monthlyFlow(inflows, expenses, ym) {
  const inRows = (inflows || []).filter((r) => r && (r.date || '').startsWith(ym) && Number(r.amount) > 0)
  const outRows = (expenses || []).filter((r) => r && (r.date || '').startsWith(ym) && Number(r.amount) > 0)

  const byKind = { inntekt: 0, refusjon: 0, overforing: 0 }
  for (const r of inRows) {
    const k = r.kind || 'inntekt'
    byKind[k] = (byKind[k] || 0) + Number(r.amount)
  }

  const inTotal = inRows.reduce((s, r) => s + Number(r.amount), 0)
  const out = outRows.reduce((s, r) => s + Number(r.amount), 0)
  const income = byKind.inntekt + byKind.refusjon

  return {
    in: inTotal,
    out,
    net: inTotal - out, // endring i saldo denne måneden
    income, // det du faktisk fikk inn utenfra
    transfers: byKind.overforing,
    byKind,
    // Sparerate gir bare mening når det finnes ekte inntekt å måle mot.
    savingRate: income > 0 ? (income - out) / income : null,
  }
}
