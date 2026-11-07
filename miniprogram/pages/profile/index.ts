import { getStoredUser, updateDisplayName } from '../../utils/api'

const DEFAULT_WECHAT_DISPLAY_NAME = '微信用户'

Page({
  data: {
    nickname: '',
    busy: false,
    error: '',
    isEdit: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const isEdit = options?.mode === 'edit'
    const current = getStoredUser()?.displayName ?? ''
    this.setData({
      isEdit,
      nickname: current && current !== DEFAULT_WECHAT_DISPLAY_NAME ? current : '',
    })
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ nickname: event.detail.value, error: '' })
  },

  onBlur(event: WechatMiniprogram.Input) {
    this.setData({ nickname: event.detail.value })
  },

  goBack() {
    if (this.data.isEdit) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/today/index' })
    }
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
      this.goBack()
    } catch (error) {
      const failure = error as { message?: string }
      this.setData({ error: failure.message || '保存失败，请稍后重试' })
    } finally {
      this.setData({ busy: false })
    }
  },

  skip() {
    this.goBack()
  },
})
