import { updateDisplayName } from '../../utils/api'

Page({
  data: {
    nickname: '',
    busy: false,
    error: '',
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ nickname: event.detail.value, error: '' })
  },

  onBlur(event: WechatMiniprogram.Input) {
    this.setData({ nickname: event.detail.value })
  },

  async save() {
    if (this.data.busy) return
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      this.setData({ error: '请输入昵称' })
      return
    }
    this.setData({ busy: true, error: '' })
    try {
      await updateDisplayName(nickname)
      wx.switchTab({ url: '/pages/today/index' })
    } catch (error) {
      const failure = error as { message?: string }
      this.setData({ error: failure.message || '保存失败，请稍后重试' })
    } finally {
      this.setData({ busy: false })
    }
  },

  skip() {
    wx.switchTab({ url: '/pages/today/index' })
  },
})
