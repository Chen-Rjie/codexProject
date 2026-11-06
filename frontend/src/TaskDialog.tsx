import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from './api'
import type { Task, TaskInput, TaskPriority, TaskStatus } from './types'

interface TaskDialogProps {
  open: boolean
  task: Task | null
  initialStatus: TaskStatus
  onClose: () => void
  onSave: (input: TaskInput) => Promise<void>
}

export function TaskDialog({
  open,
  task,
  initialStatus,
  onClose,
  onSave,
}: TaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setStatus(task?.status ?? initialStatus)
    setPriority(task?.priority ?? 'MEDIUM')
    setDueDate(task?.dueDate ?? '')
    setError('')
    setFieldErrors({})
  }, [initialStatus, open, task])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        dueDate: dueDate || null,
      })
      onClose()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors(caught.fieldErrors ?? {})
      } else {
        setError('保存失败，请检查后端服务是否已启动。')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-accent" />
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{task ? '编辑任务' : '创建任务'}</span>
            <h2 id="task-dialog-title">
              {task ? '调整执行计划' : '记录下一件重要的事'}
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <label className="form-field">
            <span>任务标题</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：完成首页视觉稿"
              maxLength={120}
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title && <small className="field-error">{fieldErrors.title}</small>}
          </label>

          <label className="form-field">
            <span>补充说明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="记录目标、验收标准或上下文"
              maxLength={1000}
              rows={4}
            />
            <small className="field-hint">{description.length}/1000</small>
          </label>

          <div className="form-grid">
            <label className="form-field">
              <span>状态</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                <option value="TODO">待处理</option>
                <option value="IN_PROGRESS">进行中</option>
                <option value="DONE">已完成</option>
              </select>
            </label>

            <label className="form-field">
              <span>优先级</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                <option value="LOW">低</option>
                <option value="MEDIUM">中</option>
                <option value="HIGH">高</option>
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>截止日期</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="dialog-actions">
            <button className="button button-ghost" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button button-primary" type="submit" disabled={saving || !title.trim()}>
              {saving ? '保存中…' : task ? '保存修改' : '创建任务'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

