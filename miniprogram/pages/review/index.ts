import {
  ensureLogin,
  listItems,
  listSessions,
  listSkills,
  skillBudget,
  type StudyItem,
  type StudySession,
  type StudySkill,
} from '../../utils/api'
import { addDays, localDate, monthDay, weekStart, weekday } from '../../utils/date'
import { getSelectedWeek, setSelectedWeek } from '../../utils/weekState'

interface DayBar {
  label: string
  minutes: number
  height: number
}

interface SkillView extends StudySkill {
  minutes: number
  percent: number
}

Page({
  data: {
    loading: true,
    selectedWeekStart: getSelectedWeek(),
    weekEndLabel: '',
    totalMinutes: 0,
    targetMinutes: 0,
    activeDays: 0,
    completionRate: 0,
    doneCount: 0,
    itemCount: 0,
    streak: 0,
    bars: [] as DayBar[],
    skills: [] as SkillView[],
    insight: '',
  },

  loadSeq: 0 as number,

  onShow() {
    if (!ensureLogin()) return
    this.setData({ selectedWeekStart: getSelectedWeek() })
    void this.loadData()
  },

  onPullDownRefresh() {
    void this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    const seq = ++this.loadSeq
    this.setData({ loading: true })
    try {
      const start = this.data.selectedWeekStart
      const end = addDays(start, 6)
      const today = localDate()
      const effectiveEnd = end < today ? end : today
      const [skills, items, sessions] = await Promise.all([
        listSkills(),
        listItems(start, end),
        listSessions(addDays(start, -90), effectiveEnd),
      ])
      if (seq !== this.loadSeq) return
      const weeklySessions = sessions.filter(
        (session) => session.studiedOn >= start && session.studiedOn <= end,
      )
      const totalMinutes = weeklySessions.reduce((sum, session) => sum + session.durationMinutes, 0)
      const daily = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index)
        return {
          label: `${monthDay(date)} ${weekday(date)}`,
          minutes: weeklySessions
            .filter((session) => session.studiedOn === date)
            .reduce((sum, session) => sum + session.durationMinutes, 0),
        }
      })
      const maxMinutes = Math.max(1, ...daily.map((entry) => entry.minutes))
      const doneCount = items.filter((item) => item.status === 'DONE').length
      const rateBase = items.filter((item) => item.status !== 'SKIPPED').length
      const completionRate = rateBase ? Math.round((doneCount / rateBase) * 100) : 0
      const isFutureWeek = start > today
      this.setData({
        loading: false,
        weekLabel: `${monthDay(start)} — ${monthDay(end)}`,
        isCurrentWeek: start === weekStart(),
        weekEndLabel: monthDay(end),
        totalMinutes,
        targetMinutes: skills.filter((skill) => !skill.archived).reduce((sum, skill) => sum + skillBudget(skill), 0),
        activeDays: new Set(weeklySessions.map((session) => session.studiedOn)).size,
        completionRate,
        doneCount,
        itemCount: rateBase,
        streak: this.calculateStreak(sessions, effectiveEnd),
        bars: daily.map((entry) => ({
          ...entry,
          height: Math.max(3, Math.round((entry.minutes / maxMinutes) * 100)),
        })),
        skills: skills.map((skill) => {
          const minutes = weeklySessions
            .filter((session) => session.skillId === skill.id)
            .reduce((sum, session) => sum + session.durationMinutes, 0)
          return {
            ...skill,
            minutes,
            percent: totalMinutes ? Math.round((minutes / totalMinutes) * 100) : 0,
          }
        }).filter((skill) => !skill.archived || skill.minutes > 0),
        insight: isFutureWeek
          ? '这一周还没开始，先按排好的节奏留着就好。'
          : totalMinutes === 0
            ? '还没有学习记录。下一次只需要打开计时器，专注 15 分钟。'
            : completionRate < 50
              ? '计划完成得不多，可能是这一周安排偏满。下次可以主动减少一次安排。'
              : '你正在形成稳定节奏。继续保持当前预算，不需要急着增加更多任务。',
      })
    } catch (error) {
      if (seq !== this.loadSeq) return
      this.setData({ loading: false })
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
  },

  previousWeek() {
    const next = addDays(this.data.selectedWeekStart, -7)
    setSelectedWeek(next)
    this.setData({ selectedWeekStart: next })
    void this.loadData()
  },

  nextWeek() {
    const next = addDays(this.data.selectedWeekStart, 7)
    setSelectedWeek(next)
    this.setData({ selectedWeekStart: next })
    void this.loadData()
  },

  currentWeek() {
    const next = weekStart()
    setSelectedWeek(next)
    this.setData({ selectedWeekStart: next })
    void this.loadData()
  },

  calculateStreak(sessions: StudySession[], cursor: string): number {
    const dates = new Set(sessions.map((session) => session.studiedOn))
    let day = cursor
    let streak = 0
    while (dates.has(day)) {
      streak += 1
      day = addDays(day, -1)
    }
    return streak
  },
})
