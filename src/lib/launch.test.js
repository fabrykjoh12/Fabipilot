import { describe, it, expect } from 'vitest'
import { launchChecklist } from './launch.js'

const item = (stage) => ({ stage })
const get = (res, key) => res.checks.find((c) => c.key === key)

describe('launchChecklist', () => {
  it('has all seven checks and none done for a blank project', () => {
    const res = launchChecklist({ status: 'active' }, [])
    expect(res.total).toBe(7)
    // blank: why/steps/context/repo/live/allsteps are undone; nohigh is vacuously true
    expect(res.doneCount).toBe(1)
    expect(get(res, 'nohigh').done).toBe(true)
    expect(res.ready).toBe(false)
    expect(res.pct).toBe(Math.round((1 / 7) * 100))
  })

  it('marks metadata checks done when the fields are set', () => {
    const project = { why: 'Ship', context: 'React', repoUrl: 'gh', liveUrl: 'app' }
    const res = launchChecklist(project, [item('done')])
    expect(get(res, 'why').done).toBe(true)
    expect(get(res, 'context').done).toBe(true)
    expect(get(res, 'repo').done).toBe(true)
    expect(get(res, 'live').done).toBe(true)
    expect(get(res, 'steps').done).toBe(true)
  })

  it('flags open high-priority steps as not done', () => {
    const res = launchChecklist({ why: 'x' }, [item('now'), item('done')])
    expect(get(res, 'nohigh').done).toBe(false)
    expect(get(res, 'nohigh').hint).toContain('1')
  })

  it('marks allsteps done only when steps exist and none are open', () => {
    expect(get(launchChecklist({}, []), 'allsteps').done).toBe(false)
    expect(get(launchChecklist({}, [item('next')]), 'allsteps').done).toBe(false)
    expect(get(launchChecklist({}, [item('done')]), 'allsteps').done).toBe(true)
  })

  it('is ready only when every check passes', () => {
    const project = { why: 'Ship', context: 'React', repoUrl: 'gh', liveUrl: 'app' }
    const res = launchChecklist(project, [item('done'), item('done')])
    expect(res.ready).toBe(true)
    expect(res.doneCount).toBe(7)
    expect(res.pct).toBe(100)
  })
})
