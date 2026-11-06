import type { StudyItem, StudySession, StudySkill } from './studyTypes'

export function localIsoDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekStartIso(date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay()
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1))
  return localIsoDate(copy)
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return localIsoDate(date)
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

export function formatDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export function skillMinutesThisWeek(
  skillId: number,
  sessions: StudySession[],
): number {
  return sessions
    .filter((session) => session.skillId === skillId)
    .reduce((total, session) => total + session.durationMinutes, 0)
}

export function completedDates(sessions: StudySession[]): Set<string> {
  return new Set(sessions.map((session) => session.studiedOn))
}

export function studyStreak(sessions: StudySession[], today: string): number {
  const dates = completedDates(sessions)
  let cursor = today
  let streak = 0
  while (dates.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function activeItemLabel(item: StudyItem, skills: StudySkill[]): string {
  return skills.find((skill) => skill.id === item.skillId)?.name ?? '学习计划'
}

