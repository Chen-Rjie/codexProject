import type { AuthUser } from '../../app'
import {
  completeStudyItem,
  ensureLogin,
  getStoredUser,
  listItems,
  listSessions,
  listSkills,
  logout,
  reflowItems,
  skipItem,
  type CompletionSource,
  type StudyItem,
  type StudySession,
  type StudySkill,
} from '../../utils/api'
import { addDays, localDate, monthDay, weekStart, weekday } from '../../utils/date'

const TIMER_STORAGE_KEY = 'flowboard_timer_v1'
const MAX_SESSION_MINUTES = 600

interface StoredTimer {
  item: StudyItem
  seconds: number
  running: boolean
  startedAt: number | null
  collapsed?: boolean
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
    timerCollapsed: false,
    timerGoalMinutes: 0,
    timerReachedGoal: true,
    timerProgress: 0,
    timerRemainingLabel: '',
  },

  timerHandle: 0 as number,
  loadSeq: 0 as number,
  actionLock: false,

  onLoad() {
    if (!ensureLogin()) return
    const now = new Date()
    const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekday(localDate())}`
    this.setData({ user: getStoredUser(), dateLabel })
  },

  onShow() {
    if (!ensureLogin()) return
    this.setData({ user: getStoredUser() })
    void this.loadData()
  },

  onHide() {
    this.persistTimer()
    if (this.timerHandle) {
      clearInterval(this.timerHandle)
      this.timerHandle = 0
    }
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
      timerStartedAt: stored.startedAt || 0,
      timerRunning: stored.running,
      timerCollapsed: stored.collapsed ?? false,
      timerGoalMinutes: stored.item.plannedMinutes || 0,
    })
    this.updateTimerDisplay(seconds)
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
      collapsed: this.data.timerCollapsed,
    }
    wx.setStorageSync(TIMER_STORAGE_KEY, stored)
  },

  clearTimer() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle)
      this.timerHandle = 0
    }
    wx.removeStorageSync(TIMER_STORAGE_KEY)
    this.setData({
      timerItem: null,
      timerSeconds: 0,
      timerStartedAt: 0,
      timerRunning: false,
      timerLabel: '00:00',
      timerCollapsed: false,
      timerGoalMinutes: 0,
      timerReachedGoal: true,
      timerProgress: 0,
      timerRemainingLabel: '',
    })
  },

  reconcileTimer(items: StudyItem[]) {
    if (!this.data.timerItem) return
    const latest = items.find((item) => item.id === this.data.timerItem?.id)
    if (!latest || latest.status !== 'PLANNED' || latest.plannedDate !== localDate()) {
      this.clearTimer()
      return
    }
    this.setData({
      timerItem: latest,
      timerGoalMinutes: latest.plannedMinutes || 0,
    })
    this.updateTimerDisplay(this.data.timerSeconds)
  },

  async loadData() {
    const seq = ++this.loadSeq
    this.setData({ loading: true })
    try {
      const today = localDate()
      const start = weekStart()
      const reflow = await reflowItems()
      if (reflow.movedItems > 0) {
        wx.showToast({ title: `已顺延 ${reflow.movedItems} 项错过的安排`, icon: 'none' })
      }
      const [skills, items, sessions] = await Promise.all([
        listSkills(),
        listItems(start, addDays(start, 6)),
        listSessions(),
      ])
      if (seq !== this.loadSeq) return
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
      if (seq !== this.loadSeq) return
      this.restoreTimer()
      this.reconcileTimer(todayItems)
    } catch (error) {
      if (seq !== this.loadSeq) return
      this.setData({ loading: false })
      this.reconcileTimer(this.data.todayItems)
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
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

  startTimer(event: WechatMiniprogram.BaseEvent) {
    if (this.data.timerItem) {
      if (this.data.timerCollapsed) {
        this.setData({ timerCollapsed: false })
        this.persistTimer()
        wx.showToast({ title: '已展开当前专注', icon: 'none' })
      } else {
        wx.showToast({ title: '请先结束当前专注', icon: 'none' })
      }
      return
    }
    const id = Number(event.currentTarget.dataset.id)
    const item = this.data.todayItems.find((entry) => entry.id === id) || null
    if (!item || item.status !== 'PLANNED') return
    this.setData({
      timerItem: item,
      timerStartedAt: Date.now(),
      timerRunning: true,
      timerCollapsed: false,
      timerGoalMinutes: item.plannedMinutes || 0,
    })
    this.updateTimerDisplay(0)
    this.startInterval()
    this.persistTimer()
  },

  updateTimerDisplay(seconds: number) {
    const goal = this.data.timerGoalMinutes || 0
    const target = Math.max(1, goal) * 60
    const remaining = Math.max(0, Math.ceil((target - seconds) / 60))
    this.setData({
      timerSeconds: seconds,
      timerLabel: timerLabel(seconds),
      timerReachedGoal: goal === 0 || seconds >= target,
      timerProgress: Math.min(100, Math.round((seconds / target) * 100)),
      timerRemainingLabel: goal === 0
        ? '自由专注'
        : remaining > 0 ? `还需 ${remaining} 分钟` : '已达成目标',
    })
  },

  startInterval() {
    if (this.timerHandle) clearInterval(this.timerHandle)
    this.timerHandle = setInterval(() => {
      const seconds = this.data.timerStartedAt
        ? Math.max(0, Math.floor((Date.now() - this.data.timerStartedAt) / 1000))
        : this.data.timerSeconds
      this.updateTimerDisplay(seconds)
    }, 1000) as unknown as number
  },

  toggleTimerCard() {
    this.setData({ timerCollapsed: !this.data.timerCollapsed })
    this.persistTimer()
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

  confirmEarlyFinish(goal: number, elapsed: number): Promise<boolean> {
    return new Promise((resolve) => {
      wx.showModal({
        title: '提前结束这次专注？',
        content: `计划 ${goal} 分钟，已专注约 ${elapsed} 分钟。提前结束会按 ${elapsed} 分钟记录，并把这项任务标记为完成。`,
        confirmText: '仍要结束',
        cancelText: '继续专注',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
  },

  async finishTimer() {
    if (!this.data.timerItem) return
    const goal = this.data.timerGoalMinutes
    const elapsed = Math.max(1, Math.ceil(this.data.timerSeconds / 60))
    if (goal > 0 && !this.data.timerReachedGoal) {
      const confirmed = await this.confirmEarlyFinish(goal, Math.min(MAX_SESSION_MINUTES, elapsed))
      if (!confirmed) return
    }
    if (elapsed > MAX_SESSION_MINUTES) {
      const confirmed = await new Promise<boolean>((resolve) => wx.showModal({
        title: '专注时间较长',
        content: `单次最多记录 ${MAX_SESSION_MINUTES} 分钟，超出部分不会计入。`,
        confirmText: '继续记录',
        cancelText: '返回',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      }))
      if (!confirmed) return
    }
    const recorded = await this.recordDone(this.data.timerItem, Math.min(MAX_SESSION_MINUTES, elapsed), 'timer')
    if (!recorded) return
    if (this.data.timerItem) this.clearTimer()
  },

  async quickComplete(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const item = this.data.todayItems.find((entry) => entry.id === id)
    if (item) await this.recordDone(item, Math.min(MAX_SESSION_MINUTES, item.plannedMinutes), 'planned')
  },

  async recordDone(item: StudyItem, minutes: number, source: CompletionSource): Promise<boolean> {
    if (this.actionLock) return false
    this.actionLock = true
    wx.showLoading({ title: '记录中' })
    try {
      await completeStudyItem(item.id, minutes, source)
      await this.loadData()
      wx.hideLoading()
      wx.showToast({ title: '已记录', icon: 'success' })
      return true
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: (error as { message?: string }).message || '记录失败', icon: 'none' })
      return false
    } finally {
      this.actionLock = false
    }
  },

  async skip(event: WechatMiniprogram.BaseEvent) {
    if (this.actionLock) return
    this.actionLock = true
    const id = Number(event.currentTarget.dataset.id)
    try {
      await skipItem(id)
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '操作失败', icon: 'none' })
    } finally {
      this.actionLock = false
    }
  },

  goSkills() {
    wx.switchTab({ url: '/pages/skills/index' })
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/index' })
  },

  editNickname() {
    wx.navigateTo({ url: '/pages/profile/index?mode=edit' })
  },

  async logout() {
    await logout()
  },
})
