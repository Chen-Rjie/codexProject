import {
  ensureLogin,
  listItems,
  listSessions,
  listSkills,
  type StudyItem,
  type StudySession,
  type StudySkill,
} from '../../utils/api'
import { addDays, localDate, monthDay, weekStart, weekday } from '../../utils/date'

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

  onShow() {
    if (!ensureLogin()) return
    void this.loadData()
  },

  onPullDownRefresh() {
    void this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const start = weekStart()
      const end = addDays(start, 6)
      const [skills, items, sessions] = await Promise.all([
        listSkills(),
        listItems(start, end),
        listSessions(),
      ])
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
      const completionRate = items.length ? Math.round((doneCount / items.length) * 100) : 0
      this.setData({
        loading: false,
        totalMinutes,
        targetMinutes: skills.reduce((sum, skill) => sum + skill.weeklyMinutes, 0),
        activeDays: new Set(weeklySessions.map((session) => session.studiedOn)).size,
        completionRate,
        doneCount,
        itemCount: items.length,
        streak: this.calculateStreak(sessions),
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
        }),
        insight: totalMinutes === 0
          ? '还没有学习记录。下一次只需要打开计时器，专注 15 分钟。'
          : completionRate < 50
            ? '计划完成得不多，可能是本周安排偏满。下一周可以主动减少一次安排。'
            : '你正在形成稳定节奏。继续保持当前预算，不需要急着增加更多任务。',
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
  },

  calculateStreak(sessions: StudySession[]): number {
    const dates = new Set(sessions.map((session) => session.studiedOn))
    let cursor = localDate()
    let streak = 0
    while (dates.has(cursor)) {
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return streak
  },
})

