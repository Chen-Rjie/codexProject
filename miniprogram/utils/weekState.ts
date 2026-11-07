import { weekStart } from './date'

let selectedWeekStart = ''

export function getSelectedWeek(): string {
  return selectedWeekStart || weekStart()
}

export function setSelectedWeek(value: string) {
  selectedWeekStart = value
}
