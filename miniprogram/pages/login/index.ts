import { ENABLE_PASSWORD_LOGIN } from '../../config'

const DEFAULT_WECHAT_DISPLAY_NAME = '微信用户'
import {
  clearSession,
  hasSession,
  loginWithPassword,
  loginWithWeChat,
} from '../../utils/api'

Page({
  data: {
    enablePasswordLogin: ENABLE_PASSWORD_LOGIN,
    username: '',
    password: '',
    busy: false,
    error: '',
  },

  onLoad() {
    if (hasSession()) {
      wx.switchTab({ url: '/pages/today/index' })
    }
  },

  onUsername(event: WechatMiniprogram.Input) {
    this.setData({ username: event.detail.value })
  },

  onPassword(event: WechatMiniprogram.Input) {
    this.setData({ password: event.detail.value })
  },

  async wechatLogin() {
    if (this.data.busy) return
    this.setData({ busy: true, error: '' })
    try {
      const user = await loginWithWeChat()
      if (user.displayName === DEFAULT_WECHAT_DISPLAY_NAME) {
        wx.redirectTo({ url: '/pages/profile/index' })
      } else {
        wx.switchTab({ url: '/pages/today/index' })
      }
    } catch (error) {
      const failure = error as { message?: string }
      this.setData({
        error: failure.message || '微信登录失败，请检查 AppID 和后端配置。',
      })
    } finally {
      this.setData({ busy: false })
    }
  },

  async passwordLogin() {
    if (this.data.busy) return
    if (!this.data.username.trim() || !this.data.password) {
      this.setData({ error: '请输入用户名和密码' })
      return
    }
    this.setData({ busy: true, error: '' })
    try {
      await loginWithPassword(this.data.username.trim(), this.data.password)
      wx.switchTab({ url: '/pages/today/index' })
    } catch (error) {
      const failure = error as { message?: string }
      this.setData({ error: failure.message || '登录失败' })
    } finally {
      this.setData({ busy: false })
    }
  },

  resetSession() {
    clearSession()
    this.setData({ error: '已清除本地登录状态，请重新登录。' })
  },
})

