import {
  completeStudyItem,
  createItem,
  deleteStudyItem,
  ensureLogin,
  generatePlan,
  listItems,
  listSkills,
  skipItem,
  type StudyItem,
  type StudySkill,
} from '../../utils/api'
import { addDays, localDate, monthDay, weekStart, weekday } from '../../utils/date'
import { getSelectedWeek, setSelectedWeek } from '../../utils/weekState'

interface PlanItem extends StudyItem {
  skillName: string
  accent: string
}

interface PlanDay {
  date: string
  label: string
  weekday: string
  today: boolean
  items: PlanItem[]
}

Page({
  data: {
    loading: true,
    selectedWeekStart: getSelectedWeek(),
    weekLabel: '',
    isCurrentWeek: true,
    today: localDate(),
    scrollTarget: '',
    days: [] as PlanDay[],
    dateOptions: [] as string[],
    dateLabels: [] as string[],
    dateIndex: 0,
    skills: [] as StudySkill[],
    selectableSkills: [] as StudySkill[],
    itemCount: 0,
    plannedMinutes: 0,
    doneCount: 0,
    dialogOpen: false,
    saving: false,
    skillIndex: 0,
    title: '',
    note: '',
    plannedDate: localDate(),
    minutesOptions: [15, 25, 30, 45, 60],
    minutesIndex: 2,
  },

  onShow() {
    if (!ensureLogin()) return
    this.setData({ selectedWeekStart: getSelectedWeek() })
    void this.loadData()
  },

  onPullDownRefresh() {
    void this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const start = this.data.selectedWeekStart
      const [skills, items] = await Promise.all([
        listSkills(),
        listItems(start, addDays(start, 6)),
      ])
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index)
        return {
          date,
          label: monthDay(date),
          weekday: `周${weekday(date)}`,
          today: date === localDate(),
          items: items
            .filter((item) => item.plannedDate === date)
            .map((item) => {
              const skill = skills.find((entry) => entry.id === item.skillId)
              const skillName = skill?.name || '学习'
              const prefix = `${skillName} · `
              const title = item.title.startsWith(prefix) ? item.title.slice(prefix.length) : item.title
              return {
                ...item,
                title,
                skillName,
                accent: skill?.accent || '#DBFF73',
              }
            }),
        }
      })
      const isCurrentWeek = start === weekStart()
      const scrollTarget = isCurrentWeek ? `day-${localDate()}` : `day-${start}`
      this.setData({
        loading: false,
        isCurrentWeek,
        today: localDate(),
        days,
        dateOptions: days.map((day) => day.date),
        dateLabels: days.map((day) => `${day.label} ${day.weekday}`),
        skills,
        selectableSkills: skills.filter((skill) => !skill.archived && skill.active),
        itemCount: items.length,
        plannedMinutes: items.reduce((sum, item) => sum + item.plannedMinutes, 0),
        doneCount: items.filter((item) => item.status === 'DONE').length,
        weekLabel: `${monthDay(start)} — ${monthDay(addDays(start, 6))}`,
        scrollTarget: '',
      }, () => {
        this.setData({ scrollTarget })
      })
    } catch (error) {
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

  defaultAddDate() {
    const start = this.data.selectedWeekStart
    const today = localDate()
    return today >= start && today <= addDays(start, 6) ? today : start
  },

  openAdd(event: WechatMiniprogram.BaseEvent) {
    if (this.data.selectableSkills.length === 0) {
      wx.showToast({ title: '请先添加技能', icon: 'none' })
      return
    }
    const date = (event.currentTarget.dataset.date as string) || this.defaultAddDate()
    const dateOptions = this.data.dateOptions
    const dateIndex = Math.max(0, dateOptions.indexOf(date))
    this.setData({
      dialogOpen: true,
      plannedDate: dateOptions[dateIndex] || date,
      dateIndex,
      title: '',
      note: '',
      skillIndex: 0,
    })
  },

  async batchGenerate() {
    const skills = this.data.selectableSkills
    if (skills.length === 0) {
      wx.showToast({ title: '没有进行中的技能', icon: 'none' })
      return
    }
    if (this.data.selectedWeekStart < weekStart()) {
      wx.showToast({ title: '过去的一周不能再排计划', icon: 'none' })
      return
    }
    const listed = skills.slice(0, 5)
    const labels = [...listed.map((skill) => skill.name), '全部技能']
    const choice = await new Promise<number>((resolve) => wx.showActionSheet({
      itemList: labels,
      success: (result) => resolve(result.tapIndex),
      fail: () => resolve(-1),
    }))
    if (choice < 0) return
    const targets = choice === listed.length ? skills : [listed[choice]]
    if (!targets[0]) return
    wx.showLoading({ title: '正在排这一周' })
    try {
      let created = 0
      for (const skill of targets) {
        const planned = await generatePlan(skill.id, this.data.selectedWeekStart)
        created += planned.length
      }
      await this.loadData()
      wx.hideLoading()
      wx.showToast({
        title: created > 0 ? `已排入 ${created} 项安排` : '这一周已经排好了',
        icon: 'none',
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: (error as { message?: string }).message || '排期失败', icon: 'none' })
    }
  },

  closeDialog() {
    this.setData({ dialogOpen: false })
  },

  noop() {},

  onSkill(event: WechatMiniprogram.PickerChange) {
    this.setData({ skillIndex: Number(event.detail.value) })
  },

  onDate(event: WechatMiniprogram.PickerChange) {
    const dateIndex = Number(event.detail.value)
    this.setData({ dateIndex, plannedDate: this.data.dateOptions[dateIndex] })
  },

  onTitle(event: WechatMiniprogram.Input) {
    this.setData({ title: event.detail.value })
  },

  onNote(event: WechatMiniprogram.Input) {
    this.setData({ note: event.detail.value })
  },

  onMinutes(event: WechatMiniprogram.PickerChange) {
    this.setData({ minutesIndex: Number(event.detail.value) })
  },

  async saveItem() {
    if (!this.data.title.trim() || this.data.saving) {
      if (!this.data.title.trim()) wx.showToast({ title: '请输入学习内容', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await createItem({
        skillId: this.data.selectableSkills[this.data.skillIndex].id,
        title: this.data.title.trim(),
        note: this.data.note.trim(),
        plannedDate: this.data.dateOptions[this.data.dateIndex] || this.data.plannedDate,
        plannedMinutes: this.data.minutesOptions[this.data.minutesIndex],
      })
      this.setData({ dialogOpen: false })
      await this.loadData()
      wx.showToast({ title: '已加入这一周', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '添加失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async complete(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const minutes = Number(event.currentTarget.dataset.minutes)
    try {
      await completeStudyItem(id, minutes, 'week')
      await this.loadData()
      wx.showToast({ title: `已按计划 ${minutes} 分钟记录`, icon: 'none' })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '操作失败', icon: 'none' })
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

  async removeItem(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const result = await new Promise<WechatMiniprogram.ShowModalSuccessCallbackResult>(
      (resolve) => wx.showModal({
        title: '删除这项安排',
        content: '删除后不计入完成率，也不会产生学习记录。',
        confirmText: '删除',
        success: resolve,
      }),
    )
    if (!result.confirm) return
    try {
      await deleteStudyItem(id)
      await this.loadData()
      wx.showToast({ title: '已删除', icon: 'none' })
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '删除失败', icon: 'none' })
    }
  },
})
