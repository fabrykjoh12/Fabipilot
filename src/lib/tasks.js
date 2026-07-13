// Rene hjelpere for gjentakende oppgaver — ingen Dexie/React.
// Brukt av setTaskDone i db.js; testet i tasks.test.js.
import { nextDate } from './dates.js'

/**
 * Bygg neste forekomst av en gjentakende oppgave. Feltene som identifiserer
 * SELVE oppgaven (title/repeat/estimate) arves; status nullstilles; datoen
 * flyttes ett intervall fram. `id`/`sortOrder`/`createdAt` settes av kalleren.
 */
export function nextTaskOccurrence(task) {
  return {
    title: task.title,
    isDone: false,
    isFocus: false,
    dueDate: nextDate(task.dueDate, task.repeat),
    completedAt: null,
    estimate: task.estimate || null,
    repeat: task.repeat,
    subtasks: [],
  }
}

/**
 * Skal vi lage neste forekomst når `task` hukes av?
 * Kun hvis den gjentar seg, har en dato, OG det ikke allerede finnes en åpen
 * forekomst på måldatoen. Det siste hindrer duplikater når man huker en
 * gjentakende oppgave av/på flere ganger (den reelle bug-en dette fikser).
 *
 * `siblings` = eksisterende oppgaver å sjekke mot (typisk de med måldatoen).
 */
export function shouldSpawnRepeat(task, siblings = []) {
  if (!task || !task.repeat || task.repeat === 'none' || !task.dueDate) return false
  const target = nextDate(task.dueDate, task.repeat)
  return !siblings.some(
    (o) =>
      o.id !== task.id &&
      !o.isDone &&
      o.repeat === task.repeat &&
      o.title === task.title &&
      o.dueDate === target,
  )
}
