import {
  completeItem,
  createItem,
  ensureLogin,
  listItems,
  listSkills,
  reflowItems,
  skipItem,
  type StudyItem,
  type StudySkill,
} from '../../utils/api'
import { addDays, localDate, monthDay, weekStart, weekday } from '../../utils/date'

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
    selectedWeekStart: weekStart(),
    weekLabel: '',
    scrollTarget: '',
    days: [] as PlanDay[],
    skills: [] as StudySkill[],
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
    void this.loadData()
  },

  onPullDownRefresh() {
    void this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const start = this.data.selectedWeekStart
      await reflowItems()
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
              return {
                ...item,
                skillName: skill?.name || '学习',
                accent: skill?.accent || '#DBFF73',
              }
            }),
        }
      })
      this.setData({
        loading: false,
        days,
        skills,
        itemCount: items.length,
        plannedMinutes: items.reduce((sum, item) => sum + item.plannedMinutes, 0),
        doneCount: items.filter((item) => item.status === 'DONE').length,
        weekLabel: `${monthDay(start)} — ${monthDay(addDays(start, 6))}`,
        scrollTarget: `day-${localDate()}`,
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: (error as { message?: string }).message || '加载失败', icon: 'none' })
    }
  },

  previousWeek() {
    this.setData({ selectedWeekStart: addDays(this.data.selectedWeekStart, -7) })
    void this.loadData()
  },

  nextWeek() {
    this.setData({ selectedWeekStart: addDays(this.data.selectedWeekStart, 7) })
    void this.loadData()
  },

  currentWeek() {
    this.setData({ selectedWeekStart: weekStart() })
    void this.loadData()
  },

  openAdd(event: WechatMiniprogram.BaseEvent) {
    const date = (event.currentTarget.dataset.date as string) || localDate()
    if (this.data.skills.length === 0) {
      wx.showToast({ title: '请先添加技能', icon: 'none' })
      return
    }
    this.setData({
      dialogOpen: true,
      plannedDate: date,
      title: '',
      note: '',
      skillIndex: 0,
    })
  },

  closeDialog() {
    this.setData({ dialogOpen: false })
  },

  noop() {},

  onSkill(event: WechatMiniprogram.PickerChange) {
    this.setData({ skillIndex: Number(event.detail.value) })
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
        skillId: this.data.skills[this.data.skillIndex].id,
        title: this.data.title.trim(),
        note: this.data.note.trim(),
        plannedDate: this.data.plannedDate,
        plannedMinutes: this.data.minutesOptions[this.data.minutesIndex],
      })
      this.setData({ dialogOpen: false })
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: (error as { message?: string }).message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async complete(event: WechatMiniprogram.BaseEvent) {
    const id = Number(event.currentTarget.dataset.id)
    const minutes = Number(event.currentTarget.dataset.minutes)
    try {
      await completeItem(id, minutes)
      await this.loadData()
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
})

