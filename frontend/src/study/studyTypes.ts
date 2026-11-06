export interface StudySkill {
  id: number
  name: string
  description: string
  accent: string
  weeklyMinutes: number
  sessionMinutes: number
  sessionsPerWeek: number
  active: boolean
  createdAt: string
}

export type StudyItemStatus = 'PLANNED' | 'DONE' | 'SKIPPED'

export interface StudyItem {
  id: number
  skillId: number
  title: string
  note: string
  plannedDate: string
  plannedMinutes: number
  status: StudyItemStatus
  completedAt: string | null
}

export interface StudySession {
  id: number
  skillId: number
  itemId: number | null
  durationMinutes: number
  studiedOn: string
  note: string
  createdAt: string
}

export interface SkillInput {
  name: string
  description: string
  accent: string
  weeklyMinutes: number
  sessionMinutes: number
  sessionsPerWeek: number
  active: boolean
}

export interface StudyItemInput {
  skillId: number
  title: string
  note: string
  plannedDate: string
  plannedMinutes: number
}

export type StudyView = 'today' | 'skills' | 'plan' | 'review'

