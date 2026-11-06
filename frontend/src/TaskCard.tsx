import { CheckIcon, EditIcon, TrashIcon } from './icons'
import {
  priorityMeta,
  statusMeta,
  type Task,
  type TaskStatus,
} from './types'

interface TaskCardProps {
  task: Task
  busy: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onChangeStatus: (task: Task, status: TaskStatus) => void
}

function formatDueDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === 'DONE') return false
  const now = new Date()
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return task.dueDate < localToday
}

function nextAction(task: Task): { label: string; status: TaskStatus } | null {
  if (task.status === 'TODO') return { label: '开始处理', status: 'IN_PROGRESS' }
  if (task.status === 'IN_PROGRESS') return { label: '标记完成', status: 'DONE' }
  return null
}

export function TaskCard({
  task,
  busy,
  onEdit,
  onDelete,
  onChangeStatus,
}: TaskCardProps) {
  const next = nextAction(task)
  const priority = priorityMeta[task.priority]
  const status = statusMeta[task.status]
  const overdue = isOverdue(task)

  return (
    <article className={`task-card ${task.status === 'DONE' ? 'task-card-done' : ''}`}>
      <div className="task-card-topline">
        <span className={`priority-pill ${priority.className}`}>
          <span className="priority-dot" />
          {priority.label}优先级
        </span>
        <div className="card-actions">
          <button
            className="icon-button card-action"
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`编辑 ${task.title}`}
            disabled={busy}
          >
            <EditIcon />
          </button>
          <button
            className="icon-button card-action card-action-danger"
            type="button"
            onClick={() => onDelete(task)}
            aria-label={`删除 ${task.title}`}
            disabled={busy}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}

      <div className="task-meta">
        {task.dueDate ? (
          <span className={overdue ? 'due-date due-date-overdue' : 'due-date'}>
            <span className="calendar-dot" />
            {overdue ? '已逾期 · ' : ''}
            {formatDueDate(task.dueDate)}
          </span>
        ) : (
          <span className="due-date due-date-empty">未设截止日期</span>
        )}
        <span className={`status-caption ${status.className}`}>{status.label}</span>
      </div>

      {next && (
        <button
          className="task-next-action"
          type="button"
          disabled={busy}
          onClick={() => onChangeStatus(task, next.status)}
        >
          {next.status === 'DONE' ? <CheckIcon /> : null}
          {next.label}
        </button>
      )}
    </article>
  )
}

