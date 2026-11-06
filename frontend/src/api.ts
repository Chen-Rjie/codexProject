import type {
  AuthUser,
  Task,
  TaskFilters,
  TaskInput,
  TaskPriority,
  TaskStatus,
} from './types'

const API_ROOT = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
let pendingCurrentUser: Promise<AuthUser> | null = null

interface ApiErrorBody {
  message?: string
  fieldErrors?: Record<string, string>
}

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string>

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    let body: ApiErrorBody = {}
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // Some infrastructure errors return an empty or non-JSON response.
    }
    throw new ApiError(
      response.status,
      body.message ?? `请求失败（HTTP ${response.status}）`,
      body.fieldErrors,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export interface LoginInput {
  username: string
  password: string
}

export interface RegisterInput extends LoginInput {
  displayName: string
}

export function getCurrentUser(): Promise<AuthUser> {
  if (!pendingCurrentUser) {
    pendingCurrentUser = request<AuthUser>('/auth/me').catch((error) => {
      pendingCurrentUser = null
      throw error
    })
  }
  return pendingCurrentUser
}

export function login(input: LoginInput): Promise<AuthUser> {
  return request<AuthUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((user) => {
    pendingCurrentUser = Promise.resolve(user)
    return user
  })
}

export function register(input: RegisterInput): Promise<AuthUser> {
  return request<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((user) => {
    pendingCurrentUser = Promise.resolve(user)
    return user
  })
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' }).finally(() => {
    pendingCurrentUser = null
  })
}

export function listTasks(filters: TaskFilters, signal?: AbortSignal): Promise<Task[]> {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  const query = params.toString()
  return request<Task[]>(`/tasks${query ? `?${query}` : ''}`, { signal })
}

export function createTask(input: TaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTask(id: number, input: TaskInput): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...input,
      clearDueDate: input.dueDate === null,
    }),
  })
}

export function deleteTask(id: number): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: 'DELETE' })
}

export function checkHealth(): Promise<{ status: string; service: string }> {
  return request<{ status: string; service: string }>('/health')
}

export type { TaskPriority, TaskStatus }

