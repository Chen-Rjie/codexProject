import {
  createSkill,
  deleteSkill,
  ensureLogin,
  generatePlan,
  listItems,
  listSessions,
  listSkills,
  skillBudget,
  updateSkill,
  type StudyItem,
  type StudySession,
  type StudySkill,
} from '../../utils/api'
import { addDays, weekStart } from '../../utils/date'

const MIN_WEEKLY_MINUTES = 30

interface SkillView extends StudySkill {
  minutes: number
  percent: number
  plannedCount: number
  weekItemCount: number
  budget: number
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
    sessionOptions: [15, 25, 30, 45, 60],
    sessionIndex: 2,
    countOptions: [1, 2, 3, 4, 5, 6, 7],
    countIndex: 2,
    computedBudget: 90,
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
      const [skills, items, sessions] = await Promise.all([
        listSkills(),
        listItems(start, addDays(start, 6)),
        listSessions(),
      ])
      const weekSessions = sessions.filter(
        (session) => session.studiedOn >= start && session.studiedOn <= addDays(start, 6),
      )
      const visibleSkills = skills.filter((skill) => !skill.archived)
      const views = visibleSkills.map((skill) => {
        const skillItems = items.filter((item) => item.skillId === skill.id)
        const budget = Math.max(1, skillBudget(skill))
        const minutes = weekSessions
          .filter((session) => session.skillId === skill.id)
          .reduce((sum, session) => sum + session.durationMinutes, 0)
        return {
          ...skill,
          minutes,
          budget,
          percent: Math.min(100, Math.round((minutes / budget) * 100)),
          plannedCount: skillItems.filter((item) => item.status === 'PLANNED').length,
          weekItemCount: skillItems.length,
        }
      })
      this.setData({
        loading: false,
        skills: views,
        totalTarget: visibleSkills.reduce((sum, skill) => sum + Math.max(1, skillBudget(skill)), 0),
        totalDone: weekSessions.reduce((sum, session) => sum + session.durationMinutes, 0),
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
  },

  derivedBudget(sessionIndex: number, countIndex: number): number {
    return this.data.sessionOptions[sessionIndex] * this.data.countOptions[countIndex]
  },

  openDialog() {
    this.setData({
      dialogOpen: true,
      editingId: null,
      name: '',
      description: '',
      accent: '#DBFF73',
      sessionIndex: 2,
      countIndex: 2,
      computedBudget: this.derivedBudget(2, 2),
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
    const sessionIndex = Math.max(0, this.data.sessionOptions.indexOf(skill.sessionMinutes))
    const countIndex = Math.max(0, this.data.countOptions.indexOf(skill.sessionsPerWeek))
    this.setData({
      dialogOpen: true,
      editingId: skill.id,
      name: skill.name,
      description: skill.description,
      accent: skill.accent,
      sessionIndex,
      countIndex,
      computedBudget: skill.budget,
    })
  },

  onSession(event: WechatMiniprogram.PickerChange) {
    const sessionIndex = Number(event.detail.value)
    this.setData({
      sessionIndex,
      computedBudget: this.derivedBudget(sessionIndex, this.data.countIndex),
    })
  },

  onCount(event: WechatMiniprogram.PickerChange) {
    const countIndex = Number(event.detail.value)
    this.setData({
      countIndex,
      computedBudget: this.derivedBudget(this.data.sessionIndex, countIndex),
    })
  },

  async saveSkill() {
    if (!this.data.name.trim() || this.data.saving) {
      if (!this.data.name.trim()) wx.showToast({ title: '请输入技能名称', icon: 'none' })
      return
    }
    const isNew = !this.data.editingId
    let createdCount = 0
    this.setData({ saving: true })
    try {
      const input = {
        name: this.data.name.trim(),
        description: this.data.description.trim(),
        accent: this.data.accent,
        weeklyMinutes: Math.max(MIN_WEEKLY_MINUTES, this.data.computedBudget),
        sessionMinutes: this.data.sessionOptions[this.data.sessionIndex],
        sessionsPerWeek: this.data.countOptions[this.data.countIndex],
        active: true,
      }
      if (this.data.editingId) {
        await updateSkill(this.data.editingId, input)
      } else {
        const skill = await createSkill(input)
        const created = await generatePlan(skill.id)
        createdCount = created.length
      }
      this.setData({ dialogOpen: false })
      await this.loadData()
      wx.showToast({
        title: isNew
          ? (createdCount > 0 ? `已创建技能，排入 ${createdCount} 项安排` : '已创建技能')
          : '已保存修改',
        icon: 'success',
      })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async generate(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const skill = this.data.skills.find((entry) => entry.id === id)
    if (!skill) return
    if (skill.weekItemCount > 0) {
      wx.switchTab({ url: '/pages/plan/index' })
      return
    }
    try {
      const created = await generatePlan(id)
      await this.loadData()
      if (created.length > 0) {
        wx.showToast({ title: `已生成 ${created.length} 项安排`, icon: 'none' })
      } else {
        wx.switchTab({ url: '/pages/plan/index' })
      }
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
        weeklyMinutes: Math.max(MIN_WEEKLY_MINUTES, skill.budget),
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
      (resolve) =>       wx.showModal({
        title: '移除技能',
        content: `“${skill.name}”会从技能列表移除，已经排好的计划和学习记录都会保留。`,
        confirmText: '移除',
        success: resolve,
      }),
    )
    if (!result.confirm) return
    try {
      await deleteSkill(id)
      await this.loadData()
      wx.showToast({ title: '已从列表移除', icon: 'none' })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '删除失败', icon: 'none' })
    }
  },
})
