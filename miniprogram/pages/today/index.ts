import type { AuthUser } from '../../app'
import {
  completeItem,
  bindWeChat as bindWeChatIdentity,
  ensureLogin,
  getStoredUser,
  listItems,
  listSessions,
  listSkills,
  logout,
  reflowItems,
  skipItem,
  type StudyItem,
  type StudySession,
  type StudySkill,
} from '../../utils/api'
import { addDays, localDate, monthDay, weekStart, weekday } from '../../utils/date'

const TIMER_STORAGE_KEY = 'flowboard_timer_v1'

interface StoredTimer {
  item: StudyItem
  seconds: number
  running: boolean
  startedAt: number | null
}

function timerLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

Page({
  data: {
    loading: true,
    user: null as AuthUser | null,
    today: localDate(),
    dateLabel: '',
    skills: [] as StudySkill[],
    todayItems: [] as Array<StudyItem & {
      skillName: string
      accent: string
      statusText: string
      statusClass: string
    }>,
    progress: 0,
    doneCount: 0,
    plannedMinutes: 0,
    doneMinutes: 0,
    streak: 0,
    timerItem: null as StudyItem | null,
    timerSeconds: 0,
    timerStartedAt: 0,
    timerLabel: '00:00',
    timerRunning: false,
  },

  timerHandle: 0 as number,

  onLoad() {
    if (!ensureLogin()) return
    const now = new Date()
    const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekday(localDate())}`
    this.setData({ user: getStoredUser(), dateLabel })
  },

  onShow() {
    if (!ensureLogin()) return
    this.restoreTimer()
    void this.loadData()
  },

  onHide() {
    this.persistTimer()
  },

  onPullDownRefresh() {
    void this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  onUnload() {
    this.persistTimer()
    if (this.timerHandle) clearInterval(this.timerHandle)
  },

  restoreTimer() {
    const stored = wx.getStorageSync<StoredTimer>(TIMER_STORAGE_KEY)
    if (!stored?.item?.id) return
    let seconds = stored.seconds || 0
    if (stored.running && stored.startedAt) {
      seconds = Math.max(seconds, Math.floor((Date.now() - stored.startedAt) / 1000))
    }
    this.setData({
      timerItem: stored.item,
      timerSeconds: seconds,
      timerStartedAt: stored.startedAt || 0,
      timerRunning: stored.running,
      timerLabel: timerLabel(seconds),
    })
    if (stored.running) this.startInterval()
  },

  persistTimer() {
    if (!this.data.timerItem) {
      wx.removeStorageSync(TIMER_STORAGE_KEY)
      return
    }
    const stored: StoredTimer = {
      item: this.data.timerItem,
      seconds: this.data.timerSeconds,
      running: this.data.timerRunning,
      startedAt: this.data.timerStartedAt || null,
    }
    wx.setStorageSync(TIMER_STORAGE_KEY, stored)
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const today = localDate()
      const start = weekStart()
      await reflowItems()
      const [skills, items, sessions] = await Promise.all([
        listSkills(),
        listItems(start, addDays(start, 6)),
        listSessions(),
      ])
      const todayItems = items
        .filter((item) => item.plannedDate === today)
        .map((item) => {
          const skill = skills.find((entry) => entry.id === item.skillId)
          const statusText = item.status === 'DONE'
            ? '已完成'
            : item.status === 'SKIPPED'
              ? '已跳过'
              : '待学习'
          return {
            ...item,
            skillName: skill?.name || '学习',
            accent: skill?.accent || '#DBFF73',
            statusText,
            statusClass: item.status.toLowerCase(),
          }
        })
      const doneCount = todayItems.filter((item) => item.status === 'DONE').length
      const doneMinutes = sessions
        .filter((session) => session.studiedOn === today)
        .reduce((sum, session) => sum + session.durationMinutes, 0)
      this.setData({
        loading: false,
        today,
        skills,
        todayItems,
        doneCount,
        plannedMinutes: todayItems.reduce((sum, item) => sum + item.plannedMinutes, 0),
        doneMinutes,
        progress: todayItems.length ? Math.round((doneCount / todayItems.length) * 100) : 0,
        streak: this.calculateStreak(sessions, today),
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
  },

  calculateStreak(sessions: StudySession[], today: string): number {
    const dates = new Set(sessions.map((session) => session.studiedOn))
    let cursor = today
    let streak = 0
    while (dates.has(cursor)) {
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return streak
  },

  startTimer(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const item = this.data.todayItems.find((entry) => entry.id === id) || null
    if (!item) return
    this.startInterval()
    this.setData({
      timerItem: item,
      timerSeconds: 0,
      timerStartedAt: Date.now(),
      timerLabel: '00:00',
      timerRunning: true,
    })
    this.persistTimer()
  },

  startInterval() {
    if (this.timerHandle) clearInterval(this.timerHandle)
    this.timerHandle = setInterval(() => {
      const seconds = this.data.timerStartedAt
        ? Math.max(0, Math.floor((Date.now() - this.data.timerStartedAt) / 1000))
        : this.data.timerSeconds
      this.setData({
        timerSeconds: seconds,
        timerLabel: timerLabel(seconds),
      })
    }, 1000) as unknown as number
  },

  toggleTimer() {
    if (this.data.timerRunning) {
      clearInterval(this.timerHandle)
      this.timerHandle = 0
      this.setData({ timerRunning: false, timerStartedAt: 0 })
      this.persistTimer()
    } else {
      this.setData({ timerStartedAt: Date.now() - this.data.timerSeconds * 1000 })
      this.startInterval()
      this.setData({ timerRunning: true })
      this.persistTimer()
    }
  },

  async finishTimer() {
    if (!this.data.timerItem) return
    const minutes = Math.max(1, Math.ceil(this.data.timerSeconds / 60))
    await this.recordDone(this.data.timerItem, minutes)
    clearInterval(this.timerHandle)
    this.timerHandle = 0
    wx.removeStorageSync(TIMER_STORAGE_KEY)
    this.setData({
      timerItem: null,
      timerSeconds: 0,
      timerStartedAt: 0,
      timerRunning: false,
      timerLabel: '00:00',
    })
  },

  async quickComplete(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const item = this.data.todayItems.find((entry) => entry.id === id)
    if (item) await this.recordDone(item, item.plannedMinutes)
  },

  async recordDone(item: StudyItem, minutes: number) {
    wx.showLoading({ title: '记录中' })
    try {
      await completeItem(item.id, minutes)
      await this.loadData()
      wx.hideLoading()
      wx.showToast({ title: '已记录', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: (error as { message?: string }).message || '记录失败', icon: 'none' })
    }
  },

  async skip(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    try {
      await skipItem(id)
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '操作失败', icon: 'none' })
    }
  },

  goSkills() {
    wx.switchTab({ url: '/pages/skills/index' })
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/index' })
  },

  async logout() {
    await logout()
  },

  async bindWeChat() {
    try {
      await bindWeChatIdentity()
      wx.showToast({ title: '微信已绑定', icon: 'success' })
    } catch (error) {
      wx.showToast({
        title: (error as { message?: string }).message || '绑定失败',
        icon: 'none',
      })
    }
  },
})

