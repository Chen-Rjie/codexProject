export interface AuthUser {
  id: number
  username: string
  displayName: string
}

App({
  globalData: {
    user: null as AuthUser | null,
  },
})
