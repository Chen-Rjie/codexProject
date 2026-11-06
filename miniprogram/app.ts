import {
  CLOUD_ENV_ID,
  USE_CLOUD_CONTAINER,
} from './config'

export interface AuthUser {
  id: number
  username: string
  displayName: string
}

App({
  onLaunch() {
    if (USE_CLOUD_CONTAINER && CLOUD_ENV_ID) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      })
    }
  },
  globalData: {
    user: null as AuthUser | null,
  },
})
