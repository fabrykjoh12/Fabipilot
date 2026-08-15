// MÅ stå først: Dexie leser indexedDB ved import, så polyfillen må være på plass før den.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'
import Dexie from 'dexie'
import { upgradeToAccounts } from './db.js'

/* Migrering v14 → v15: eksisterende data må få en konto.

   Dette er den farligste enkeltendringen i modellen: brukeren har et års
   bankdata liggende uten `accountId`. Blir radene kontoløse etter
   oppgraderingen, forsvinner de fra hver eneste visning selv om de ligger der.

   Testen kjører den EKTE oppgraderingsfunksjonen fra db.js mot en ekte
   Dexie-base. Den kan ikke gå veien om `db`-instansen: sky-addonen eier
   opprettelsen av basen, og en base laget med ren Dexie blir ikke gjenkjent
   som sin egen — da tømmes den, og testen ville målt addonen i stedet for
   migreringen. */

const V14 = {
  ideas: 'id, category, createdAt',
  tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
  habits: 'id, sortOrder, createdAt',
  subscriptions: 'id, createdAt',
  projects: 'id, status, sortOrder, lastTouched, createdAt',
  projectItems: 'id, projectId, stage, sortOrder, createdAt',
  events: 'id, date, createdAt',
  todos: 'id, isDone, sortOrder, createdAt',
  expenses: 'id, date, category, createdAt',
  budgets: 'id, category, createdAt',
  incomes: 'id, createdAt',
  goals: 'id, createdAt',
  sharedItems: 'id, realmId, isDone, sortOrder, createdAt',
  workdays: 'id, date, owner, createdAt',
  plans: 'id, startDate, createdAt',
  inflows: 'id, date, kind, createdAt',
  balances: 'id, date, createdAt',
}
const V15 = {
  accounts: 'id, sortOrder, createdAt',
  expenses: 'id, date, category, accountId, createdAt',
  inflows: 'id, date, kind, accountId, createdAt',
  balances: 'id, date, accountId, [accountId+date], createdAt',
}

/** Bygger en v14-base med `seed`, og oppgraderer den til v15 med ekte kode. */
async function migrate(name, seed) {
  const before = new Dexie(name)
  before.version(14).stores(V14)
  await before.open()
  await seed(before)
  before.close()

  const after = new Dexie(name)
  after.version(14).stores(V14)
  after.version(15).stores(V15).upgrade(upgradeToAccounts)
  await after.open()
  return after
}

describe('v14 → v15', () => {
  let db

  beforeAll(async () => {
    db = await migrate('migrate-med-data', async (d) => {
      await d.expenses.bulkAdd([
        { id: 'e1', date: '2026-08-04', amount: 450, category: 'dagligvarer', note: 'Rema 1000', createdAt: 1 },
        { id: 'e2', date: '2026-07-11', amount: 820, category: 'restaurant', note: 'Kaffebrenneriet', createdAt: 2 },
      ])
      await d.inflows.add({ id: 'i1', date: '2026-08-02', amount: 34000, kind: 'inntekt', note: 'Lønn', createdAt: 1 })
      await d.balances.add({ id: 'b1', date: '2026-08-01', amount: 61000, createdAt: 1 })
    })
  })

  it('lager én konto for det som fantes fra før', async () => {
    const accounts = await db.accounts.toArray()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].name).toBe('Hovedkonto')
  })

  it('mister ingen rader', async () => {
    expect(await db.expenses.count()).toBe(2)
    expect(await db.inflows.count()).toBe(1)
    expect(await db.balances.count()).toBe(1)
  })

  it('stempler ALT med den samme kontoen — kontoløse rader ville blitt usynlige', async () => {
    const acc = (await db.accounts.toArray())[0]
    const rows = [
      ...(await db.expenses.toArray()),
      ...(await db.inflows.toArray()),
      ...(await db.balances.toArray()),
    ]
    expect(rows).toHaveLength(4)
    for (const r of rows) expect(r.accountId).toBe(acc.id)
  })

  it('lar dataene være synlige gjennom de nye spørringene etterpå', async () => {
    const acc = (await db.accounts.toArray())[0]
    expect(await db.expenses.where('accountId').equals(acc.id).count()).toBe(2)
    const bal = await db.balances.where('[accountId+date]').equals([acc.id, '2026-08-01']).first()
    expect(bal.amount).toBe(61000)
  })

  it('beholder feltene som fantes fra før', async () => {
    const e = await db.expenses.get('e1')
    expect(e).toMatchObject({ date: '2026-08-04', amount: 450, category: 'dagligvarer', note: 'Rema 1000' })
  })

  it('lager INGEN konto på en tom base — en ny bruker skal ikke arve «Hovedkonto»', async () => {
    const tom = await migrate('migrate-tom', async () => {})
    expect(await tom.accounts.count()).toBe(0)
  })
})
