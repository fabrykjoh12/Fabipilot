import { describe, it, expect } from 'vitest'
import {
  projectContext, buildPrompt, buildAllPrompts, hasContext,
  projectBrief, buildRecipe, PROJECT_RECIPES,
  RECIPE_GROUPS, recommendedRecipe, buildTaskList, CLAUDE_SESSION_HOOK,
} from './prompts.js'

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

describe('projectBrief', () => {
  const project = { name: 'Site', why: 'Ship it', status: 'active', lastTouched: Date.now() }
  const items = [{ text: 'Build hero', stage: 'now' }, { text: 'Add gallery', stage: 'later' }, { text: 'Setup', stage: 'done' }]

  it('includes context, derived status and progress', () => {
    const out = projectBrief(project, items)
    expect(out).toContain('Project: Site')
    expect(out).toContain('Goal: Ship it')
    expect(out).toContain('Status: Building')
    expect(out).toContain('Progress: 1/3 steps done')
  })

  it('lists only open steps, ordered by priority', () => {
    const out = projectBrief(project, items)
    expect(out).toContain('- [High] Build hero')
    expect(out).toContain('- [Low] Add gallery')
    // done steps are not listed as open
    expect(out).not.toContain('Setup')
    expect(out.indexOf('Build hero')).toBeLessThan(out.indexOf('Add gallery'))
  })

  it('omits the open-steps block when everything is done', () => {
    const out = projectBrief(project, [{ text: 'x', stage: 'done' }])
    expect(out).not.toContain('Open steps:')
    expect(out).toContain('Status: Ready to ship')
  })
})

describe('buildRecipe', () => {
  const project = { name: 'Site', why: 'Ship it', status: 'active', lastTouched: Date.now() }
  const items = [{ text: 'Build hero', stage: 'now' }]

  it('returns empty string for an unknown recipe', () => {
    expect(buildRecipe('nope', project, items)).toBe('')
  })

  it('prefixes the project brief before the recipe ask', () => {
    const out = buildRecipe('review', project, items)
    expect(out.startsWith('Project: Site')).toBe(true)
    expect(out).toContain('---')
    expect(out).toContain('brutally honest')
  })

  it('every recipe has a key, label, emoji, ask and a known group', () => {
    for (const r of PROJECT_RECIPES) {
      expect(r.key).toBeTruthy()
      expect(r.label).toBeTruthy()
      expect(r.emoji).toBeTruthy()
      expect(r.ask.length).toBeGreaterThan(20)
      expect(RECIPE_GROUPS).toContain(r.group)
    }
  })

  it('recipe keys are unique', () => {
    const keys = PROJECT_RECIPES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('buildTaskList', () => {
  const project = { name: 'Hanzi Dojo', why: 'Lære kinesisk', context: 'React + Vite', repoUrl: 'https://github.com/x/hanzi', liveUrl: 'https://hanzi.app' }
  const items = [
    { text: 'Fix SRS timing bug', stage: 'now', result: 'Ser ut som off-by-one i intervallet' },
    { text: 'Add dark mode', stage: 'next' },
    { text: 'Ship v1', stage: 'later' },
    { text: 'Set up repo', stage: 'done' },
  ]

  it('starts with the project name as an H1', () => {
    expect(buildTaskList(project, items).startsWith('# Hanzi Dojo — oppgaver')).toBe(true)
  })

  it('includes context, goal and links', () => {
    const md = buildTaskList(project, items)
    expect(md).toContain('> Lære kinesisk')
    expect(md).toContain('Repo: https://github.com/x/hanzi')
    expect(md).toContain('**Kontekst:** React + Vite')
  })

  it('groups steps by priority with checkboxes; done is checked', () => {
    const md = buildTaskList(project, items)
    expect(md).toContain('## Høy prioritet')
    expect(md).toContain('- [ ] Fix SRS timing bug')
    expect(md).toContain('- [x] Set up repo')
  })

  it('includes a step result as a sub-bullet', () => {
    expect(buildTaskList(project, items)).toContain('  - Ser ut som off-by-one i intervallet')
  })

  it('omits empty priority groups', () => {
    const md = buildTaskList({ name: 'X' }, [{ text: 'only', stage: 'now' }])
    expect(md).toContain('## Høy prioritet')
    expect(md).not.toContain('## Ferdig')
  })
})

describe('CLAUDE_SESSION_HOOK', () => {
  it('is valid JSON with a SessionStart hook that reads TASKS.md', () => {
    const cfg = JSON.parse(CLAUDE_SESSION_HOOK)
    expect(Array.isArray(cfg.hooks.SessionStart)).toBe(true)
    const cmd = cfg.hooks.SessionStart[0].hooks[0]
    expect(cmd.type).toBe('command')
    expect(cmd.command).toContain('TASKS.md')
  })
})

describe('recommendedRecipe', () => {
  it('returns a real recipe for every health state', () => {
    for (const state of ['empty', 'building', 'stuck', 'ready', 'shipped', 'onice']) {
      const r = recommendedRecipe(state)
      expect(PROJECT_RECIPES).toContain(r)
    }
  })
  it('recommends the launch checklist when ready to ship', () => {
    expect(recommendedRecipe('ready').key).toBe('launch')
  })
  it('falls back to review for an unknown state', () => {
    expect(recommendedRecipe('weird').key).toBe('review')
  })
})
