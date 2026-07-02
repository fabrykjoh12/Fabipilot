import { describe, it, expect } from 'vitest'
import { projectContext, buildPrompt, buildAllPrompts, hasContext } from './prompts.js'

describe('projectContext', () => {
  it('returns an empty string for a project with no context fields', () => {
    expect(projectContext({ name: undefined })).toBe('')
    expect(projectContext(null)).toBe('')
  })
  it('includes only the fields that are set, in a fixed order', () => {
    const ctx = projectContext({ name: 'Site', repoUrl: 'https://github.com/x/y' })
    expect(ctx).toBe('Project: Site\nRepo: https://github.com/x/y')
  })
  it('includes all fields when fully populated', () => {
    const ctx = projectContext({
      name: 'Site', why: 'Show my work', context: 'React + Vite',
      liveUrl: 'https://site.app', repoUrl: 'https://github.com/x/y',
    })
    expect(ctx).toBe(
      'Project: Site\nGoal: Show my work\nContext: React + Vite\nLive: https://site.app\nRepo: https://github.com/x/y',
    )
  })
})

describe('hasContext', () => {
  it('is false when no optional field is set', () => {
    expect(hasContext({ name: 'Site' })).toBe(false)
    expect(hasContext(null)).toBe(false)
  })
  it('is true when any one optional field is set', () => {
    expect(hasContext({ why: 'x' })).toBe(true)
    expect(hasContext({ context: 'x' })).toBe(true)
    expect(hasContext({ liveUrl: 'x' })).toBe(true)
    expect(hasContext({ repoUrl: 'x' })).toBe(true)
  })
})

describe('buildPrompt', () => {
  it('returns the raw text when the project has no name or context fields', () => {
    expect(buildPrompt({}, 'Fix the bug')).toBe('Fix the bug')
    expect(buildPrompt(null, 'Fix the bug')).toBe('Fix the bug')
  })
  it('prefixes the context block and a Task label when context exists', () => {
    const out = buildPrompt({ name: 'Site', why: 'Ship it' }, 'Fix the bug')
    expect(out).toBe('Project: Site\nGoal: Ship it\n\nTask:\nFix the bug')
  })
})

describe('buildAllPrompts', () => {
  const items = [{ text: 'Build hero' }, { text: 'Add gallery' }]

  it('numbers every item starting at 1', () => {
    const out = buildAllPrompts({ name: 'Site' }, items)
    expect(out).toContain('1. Build hero')
    expect(out).toContain('2. Add gallery')
  })
  it('prefixes context when present', () => {
    const out = buildAllPrompts({ name: 'Site' }, items)
    expect(out.startsWith('Project: Site\n\n')).toBe(true)
  })
  it('omits the header entirely with no context', () => {
    const out = buildAllPrompts({}, items)
    expect(out.startsWith('Here\'s everything')).toBe(true)
  })
  it('handles an empty item list', () => {
    const out = buildAllPrompts({}, [])
    expect(out).toContain('Here\'s everything I want you to do:')
  })
})
