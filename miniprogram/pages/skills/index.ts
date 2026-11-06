import {
  createSkill,
  deleteSkill,
  ensureLogin,
  generatePlan,
  listItems,
  listSessions,
  listSkills,
  reflowItems,
  updateSkill,
  type StudyItem,
  type StudySession,
  type StudySkill,
} from '../../utils/api'
import { addDays, weekStart } from '../../utils/date'

interface SkillView extends StudySkill {
  minutes: number
  percent: number
  plannedCount: number
}

Page({
  data: {
    loading: true,
    skills: [] as SkillView[],
    totalTarget: 0,
    totalDone: 0,
    dialogOpen: false,
    editingId: null as number | null,
    saving: false,
    name: '',
    description: '',
    accent: '#DBFF73',
    accentOptions: ['#DBFF73', '#8EA7FF', '#FFAB91', '#7DD3B0', '#E9C46A'],
    weeklyOptions: [60, 120, 180, 300, 420],
    weeklyLabels: ['1 小时', '2 小时', '3 小时', '5 小时', '7 小时'],
    weeklyIndex: 2,
    sessionOptions: [15, 25, 30, 45, 60],
    sessionIndex: 2,
    countOptions: [1, 2, 3, 4, 5, 6, 7],
    countIndex: 2,
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
      await reflowItems()
      const [skills, items, sessions] = await Promise.all([
        listSkills(),
        listItems(start, addDays(start, 6)),
        listSessions(),
      ])
      const weekSessions = sessions.filter(
        (session) => session.studiedOn >= start && session.studiedOn <= addDays(start, 6),
      )
      const views = skills.map((skill) => {
        const minutes = weekSessions
          .filter((session) => session.skillId === skill.id)
          .reduce((sum, session) => sum + session.durationMinutes, 0)
        return {
          ...skill,
          minutes,
          percent: Math.min(100, Math.round((minutes / skill.weeklyMinutes) * 100)),
          plannedCount: items.filter(
            (item) => item.skillId === skill.id && item.status === 'PLANNED',
          ).length,
        }
      })
      this.setData({
        loading: false,
        skills: views,
        totalTarget: skills.reduce((sum, skill) => sum + skill.weeklyMinutes, 0),
        totalDone: weekSessions.reduce((sum, session) => sum + session.durationMinutes, 0),
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
  },

  openDialog() {
    this.setData({
      dialogOpen: true,
      editingId: null,
      name: '',
      description: '',
      accent: '#DBFF73',
      weeklyIndex: 2,
      sessionIndex: 2,
      countIndex: 2,
    })
  },

  closeDialog() {
    this.setData({ dialogOpen: false })
  },

  noop() {},

  onName(event: WechatMiniprogram.Input) {
    this.setData({ name: event.detail.value })
  },

  onDescription(event: WechatMiniprogram.Input) {
    this.setData({ description: event.detail.value })
  },

  chooseAccent(event: WechatMiniprogram.BaseEvent) {
    this.setData({ accent: event.currentTarget.dataset.accent as string })
  },

  editSkill(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const skill = this.data.skills.find((entry) => entry.id === id)
    if (!skill) return
    this.setData({
      dialogOpen: true,
      editingId: skill.id,
      name: skill.name,
      description: skill.description,
      accent: skill.accent,
      weeklyIndex: Math.max(0, this.data.weeklyOptions.indexOf(skill.weeklyMinutes)),
      sessionIndex: Math.max(0, this.data.sessionOptions.indexOf(skill.sessionMinutes)),
      countIndex: Math.max(0, this.data.countOptions.indexOf(skill.sessionsPerWeek)),
    })
  },

  onWeekly(event: WechatMiniprogram.PickerChange) {
    this.setData({ weeklyIndex: Number(event.detail.value) })
  },

  onSession(event: WechatMiniprogram.PickerChange) {
    this.setData({ sessionIndex: Number(event.detail.value) })
  },

  onCount(event: WechatMiniprogram.PickerChange) {
    this.setData({ countIndex: Number(event.detail.value) })
  },

  async saveSkill() {
    if (!this.data.name.trim() || this.data.saving) {
      if (!this.data.name.trim()) wx.showToast({ title: '请输入技能名称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const input = {
        name: this.data.name.trim(),
        description: this.data.description.trim(),
        accent: this.data.accent,
        weeklyMinutes: this.data.weeklyOptions[this.data.weeklyIndex],
        sessionMinutes: this.data.sessionOptions[this.data.sessionIndex],
        sessionsPerWeek: this.data.countOptions[this.data.countIndex],
        active: true,
      }
      if (this.data.editingId) {
        await updateSkill(this.data.editingId, input)
      } else {
        const skill = await createSkill(input)
        await generatePlan(skill.id)
      }
      this.setData({ dialogOpen: false })
      await this.loadData()
      wx.showToast({ title: '已生成本周计划', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async generate(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    try {
      const created = await generatePlan(id)
      await this.loadData()
      wx.showToast({
        title: created.length ? '本周计划已生成' : '本周已有计划',
        icon: 'none',
      })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '生成失败', icon: 'none' })
    }
  },

  async toggleActive(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const skill = this.data.skills.find((entry) => entry.id === id)
    if (!skill) return
    try {
      await updateSkill(id, {
        name: skill.name,
        description: skill.description,
        accent: skill.accent,
        weeklyMinutes: skill.weeklyMinutes,
        sessionMinutes: skill.sessionMinutes,
        sessionsPerWeek: skill.sessionsPerWeek,
        active: !skill.active,
      })
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '更新失败', icon: 'none' })
    }
  },

  async removeSkill(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const skill = this.data.skills.find((entry) => entry.id === id)
    if (!skill) return
    const result = await new Promise<WechatMiniprogram.ShowModalSuccessCallbackResult>(
      (resolve) => wx.showModal({
        title: '删除技能',
        content: `删除“${skill.name}”会同时删除相关计划，确定继续吗？`,
        success: resolve,
      }),
    )
    if (!result.confirm) return
    try {
      await deleteSkill(id)
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '删除失败', icon: 'none' })
    }
  },
})

