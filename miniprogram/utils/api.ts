import {
  API_BASE_URL,
  CLOUD_ENV_ID,
  CLOUD_SERVICE_NAME,
  USE_CLOUD_CONTAINER,
} from '../config'
import type { AuthUser } from '../app'
import { addDays, localDate, weekStart } from './date'
import { resetSelectedWeek } from './weekState'

const ACCESS_KEY = 'flowboard_access_token'
const REFRESH_KEY = 'flowboard_refresh_token'
const USER_KEY = 'flowboard_user'

export interface StudySkill {
  id: number
  name: string
  description: string
  accent: string
  weeklyMinutes: number
  sessionMinutes: number
  sessionsPerWeek: number
  active: boolean
  archived: boolean
  createdAt: string
}

export function skillBudget(skill: StudySkill): number {
  const product = (skill.sessionsPerWeek || 0) * (skill.sessionMinutes || 0)
  return product > 0 ? product : skill.weeklyMinutes
}

export type StudyItemStatus = 'PLANNED' | 'DONE' | 'SKIPPED'

export interface StudyItem {
  id: number
  skillId: number
  title: string
  note: string
  plannedDate: string
  plannedMinutes: number
  status: StudyItemStatus
  completedAt: string | null
}

export function visibleItems(items: StudyItem[], skills: StudySkill[]): StudyItem[] {
  const activeSkillIds = new Set(
    skills.filter((skill) => !skill.archived).map((skill) => skill.id),
  )
  return items.filter((item) => activeSkillIds.has(item.skillId))
}

export interface StudySession {
  id: number
  skillId: number
  itemId: number | null
  durationMinutes: number
  studiedOn: string
  note: string
  createdAt: string
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

interface RequestOptions {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: WechatMiniprogram.IAnyObject
  auth?: boolean
  retry?: boolean
}

function saveTokens(tokens: TokenResponse) {
  wx.setStorageSync(ACCESS_KEY, tokens.accessToken)
  wx.setStorageSync(REFRESH_KEY, tokens.refreshToken)
  wx.setStorageSync(USER_KEY, tokens.user)
  const app = getApp<{ globalData: { user: AuthUser | null } }>()
  app.globalData.user = tokens.user
  redirectingToLogin = false
}

export function getStoredUser(): AuthUser | null {
  return wx.getStorageSync(USER_KEY) || null
}

export function hasSession(): boolean {
  return Boolean(wx.getStorageSync(ACCESS_KEY) || wx.getStorageSync(REFRESH_KEY))
}

export function clearSession() {
  wx.removeStorageSync(ACCESS_KEY)
  wx.removeStorageSync(REFRESH_KEY)
  wx.removeStorageSync(USER_KEY)
  const app = getApp<{ globalData: { user: AuthUser | null } }>()
  app.globalData.user = null
  resetSelectedWeek()
}

function rawRequest<T>(options: RequestOptions): Promise<T> {
  const accessToken = wx.getStorageSync<string>(ACCESS_KEY)
  const header = {
    'Content-Type': 'application/json',
    ...(options.auth !== false && accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {}),
  }

  if (USE_CLOUD_CONTAINER) {
    return new Promise((resolve, reject) => {
      wx.cloud.callContainer({
        config: {
          env: CLOUD_ENV_ID,
        },
        path: `/api${options.path}`,
        method: options.method || 'GET',
        data: options.data,
        header: {
          ...header,
          'X-WX-SERVICE': CLOUD_SERVICE_NAME,
        },
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data as T)
            return
          }
          const body = response.data as { message?: string }
          reject({
            status: response.statusCode,
            message: body?.message || `请求失败（${response.statusCode}）`,
          })
        },
        fail(error) {
          reject({ status: 0, message: error.errMsg || '云托管连接失败' })
        },
      })
    })
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.path}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        const body = response.data as { message?: string }
        reject({
          status: response.statusCode,
          message: body?.message || `请求失败（${response.statusCode}）`,
        })
      },
      fail(error) {
        reject({ status: 0, message: error.errMsg || '网络连接失败' })
      },
    })
  })
}

let inflightRefresh: Promise<boolean> | null = null
let redirectingToLogin = false

async function doRefreshSession(): Promise<boolean> {
  const refreshToken = wx.getStorageSync<string>(REFRESH_KEY)
  if (!refreshToken) {
    clearSession()
    return false
  }
  try {
    const tokens = await rawRequest<TokenResponse>({
      path: '/auth/token/refresh',
      method: 'POST',
      data: { refreshToken },
      auth: false,
    })
    saveTokens(tokens)
    return true
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 400 || status === 401 || status === 403) {
      clearSession()
    }
    return false
  }
}

function refreshSession(): Promise<boolean> {
  if (!inflightRefresh) {
    inflightRefresh = doRefreshSession().then(
      (ok) => {
        inflightRefresh = null
        return ok
      },
      (error) => {
        inflightRefresh = null
        throw error
      },
    )
  }
  return inflightRefresh
}

function goToLogin() {
  if (redirectingToLogin) return
  redirectingToLogin = true
  wx.reLaunch({
    url: '/pages/login/index',
    fail: () => { redirectingToLogin = false },
  })
}

export async function request<T>(options: RequestOptions): Promise<T> {
  try {
    return await rawRequest<T>(options)
  } catch (error) {
    const failure = error as { status?: number }
    if (failure.status === 401 && options.auth !== false && options.retry !== false) {
      if (await refreshSession()) {
        try {
          return await rawRequest<T>({ ...options, retry: false })
        } catch (retryError) {
          if ((retryError as { status?: number }).status === 401) {
            clearSession()
            goToLogin()
          }
          throw retryError
        }
      }
      if (!hasSession()) {
        goToLogin()
        throw error
      }
      throw {
        status: failure.status,
        message: '登录状态刷新失败，请检查网络或稍后重试',
      }
    }
    throw error
  }
}

export async function loginWithWeChat(): Promise<AuthUser> {
  let data: { code?: string } = {}
  if (!USE_CLOUD_CONTAINER) {
    const loginResult = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
      (resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      },
    )
    data = { code: loginResult.code }
  }
  const tokens = await rawRequest<TokenResponse>({
    path: '/auth/wechat/login',
    method: 'POST',
    data,
    auth: false,
  })
  saveTokens(tokens)
  return tokens.user
}

export async function updateDisplayName(displayName: string): Promise<AuthUser> {
  const user = await request<AuthUser>({
    path: '/auth/me',
    method: 'PUT',
    data: { displayName },
  })
  wx.setStorageSync(USER_KEY, user)
  const app = getApp<{ globalData: { user: AuthUser | null } }>()
  app.globalData.user = user
  return user
}

export async function loginWithPassword(username: string, password: string): Promise<AuthUser> {
  const tokens = await rawRequest<TokenResponse>({
    path: '/auth/token/login',
    method: 'POST',
    data: { username, password },
    auth: false,
  })
  saveTokens(tokens)
  return tokens.user
}

export async function logout() {
  const refreshToken = wx.getStorageSync(REFRESH_KEY)
  try {
    await request<void>({
      path: '/auth/token/logout',
      method: 'POST',
      data: { refreshToken },
      retry: false,
    })
  } finally {
    clearSession()
    wx.reLaunch({ url: '/pages/login/index' })
  }
}

export function ensureLogin() {
  if (!hasSession()) {
    wx.reLaunch({ url: '/pages/login/index' })
    return false
  }
  return true
}

export function listSkills() {
  return request<StudySkill[]>({ path: '/study/skills' })
}

export function createSkill(data: {
  name: string
  description: string
  accent: string
  weeklyMinutes: number
  sessionMinutes: number
  sessionsPerWeek: number
  active: boolean
}) {
  return request<StudySkill>({ path: '/study/skills', method: 'POST', data })
}

export function updateSkill(id: number, data: {
  name: string
  description: string
  accent: string
  weeklyMinutes: number
  sessionMinutes: number
  sessionsPerWeek: number
  active: boolean
}) {
  return request<StudySkill>({ path: `/study/skills/${id}`, method: 'PUT', data })
}

export function deleteSkill(id: number) {
  return request<void>({ path: `/study/skills/${id}`, method: 'DELETE' })
}

export function generatePlan(skillId: number, week = weekStart()) {
  return request<StudyItem[]>({
    path: `/study/skills/${skillId}/generate-plan?weekStart=${week}`,
    method: 'POST',
  })
}

export function listItems(from: string, to: string) {
  return request<StudyItem[]>({ path: `/study/items?from=${from}&to=${to}` })
}

export function createItem(data: {
  skillId: number
  title: string
  note: string
  plannedDate: string
  plannedMinutes: number
}) {
  return request<StudyItem>({ path: '/study/items', method: 'POST', data })
}

export function completeItem(id: number, durationMinutes: number, note = '') {
  return request<StudyItem>({
    path: `/study/items/${id}/complete`,
    method: 'POST',
    data: { durationMinutes, note },
  })
}

export type CompletionSource = 'timer' | 'planned' | 'week'

const COMPLETION_NOTES: Record<CompletionSource, string> = {
  timer: '计时专注记录',
  planned: '今日按计划完成',
  week: '周计划按计划完成',
}

export function completeStudyItem(id: number, minutes: number, source: CompletionSource) {
  return completeItem(id, Math.max(1, Math.round(minutes)), COMPLETION_NOTES[source])
}

export function skipItem(id: number) {
  return request<StudyItem>({
    path: `/study/items/${id}/skip`,
    method: 'POST',
    data: { reason: '小程序中暂时跳过' },
  })
}

export function deleteStudyItem(id: number) {
  return request<void>({ path: `/study/items/${id}`, method: 'DELETE' })
}

export function reflowItems() {
  return request<{ movedItems: number }>({ path: '/study/items/reflow', method: 'POST' })
}

export function listSessions(from = addDays(localDate(), -90), to = addDays(weekStart(), 6)) {
  return request<StudySession[]>({
    path: `/study/sessions?from=${from}&to=${to}`,
  })
}
