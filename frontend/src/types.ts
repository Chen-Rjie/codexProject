export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Task {
  id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskInput {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
}

export interface TaskFilters {
  search: string
  status: TaskStatus | ''
  priority: TaskPriority | ''
}

export interface AuthUser {
  id: number
  username: string
  displayName: string
}

export const statusMeta: Record<
  TaskStatus,
  { label: string; hint: string; className: string }
> = {
  TODO: {
    label: '待处理',
    hint: '等待进入执行',
    className: 'status-todo',
  },
  IN_PROGRESS: {
    label: '进行中',
    hint: '正在推进',
    className: 'status-progress',
  },
  DONE: {
    label: '已完成',
    hint: '已经交付',
    className: 'status-done',
  },
}

export const priorityMeta: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  LOW: { label: '低', className: 'priority-low' },
  MEDIUM: { label: '中', className: 'priority-medium' },
  HIGH: { label: '高', className: 'priority-high' },
}

