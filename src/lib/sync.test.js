import { describe, it, expect } from 'vitest'
import { syncLabel, syncLed } from './sync.js'

/* Bakgrunn: en utløpt sky-lisens stopper synken, men `status`/`phase` kan
   fortsatt se helt normale ut. Da viste appen «Synket ✓» mens ingenting nådde
   serveren — dataene lå kun lokalt, og forsvant da PWA-en ble slettet.
   Lisens-sjekken må derfor komme FØR alt annet. */
describe('syncLabel', () => {
  it('sier fra når lisensen er utløpt, selv om status ser normal ut', () => {
    expect(syncLabel({ status: 'connected', phase: 'in-sync', license: 'expired' })).toMatch(/utløpt/i)
    expect(syncLabel({ status: 'connected', phase: 'in-sync', license: 'expired' })).toMatch(/lokalt/i)
  })

  it('sier fra når kontoen er deaktivert', () => {
    expect(syncLabel({ status: 'connected', phase: 'in-sync', license: 'deactivated' })).toMatch(/deaktivert/i)
  })

  it('lar en gyldig lisens falle gjennom til vanlig status', () => {
    expect(syncLabel({ status: 'connected', phase: 'in-sync', license: 'ok' })).toBe('Synket ✓')
  })

  it('beholder de vanlige tilstandene', () => {
    expect(syncLabel(null)).toBe('Kobler til…')
    expect(syncLabel({ status: 'offline', phase: 'offline' })).toMatch(/frakoblet/i)
    expect(syncLabel({ status: 'error', phase: 'error' })).toBe('Sync-feil')
    expect(syncLabel({ status: 'connected', phase: 'pushing' })).toBe('Laster opp…')
    expect(syncLabel({ status: 'connected', phase: 'in-sync' })).toBe('Synket ✓')
  })
})

describe('syncLed', () => {
  it('lyser rødt på ugyldig lisens, ikke grønt', () => {
    expect(syncLed({ status: 'connected', phase: 'in-sync', license: 'expired' })).toBe('red')
    expect(syncLed({ status: 'connected', phase: 'in-sync', license: 'deactivated' })).toBe('red')
  })

  it('er grønt kun når alt faktisk er i orden', () => {
    expect(syncLed({ status: 'connected', phase: 'in-sync', license: 'ok' })).toBe('green')
    expect(syncLed({ status: 'connected', phase: 'in-sync' })).toBe('green')
  })

  it('beholder de vanlige tilstandene', () => {
    expect(syncLed(null)).toBe('amber')
    expect(syncLed({ status: 'error', phase: 'error' })).toBe('red')
    expect(syncLed({ status: 'offline', phase: 'offline' })).toBe('grey')
    expect(syncLed({ status: 'connecting', phase: 'not-in-sync' })).toBe('amber')
  })
})
