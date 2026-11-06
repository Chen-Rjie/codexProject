import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api'
import type { StudyItemInput, StudySkill } from './studyTypes'

interface StudyItemDialogProps {
  open: boolean
  date: string
  skills: StudySkill[]
  onClose: () => void
  onSave: (input: StudyItemInput) => Promise<void>
}

export function StudyItemDialog({
  open,
  date,
  skills,
  onClose,
  onSave,
}: StudyItemDialogProps) {
  const [skillId, setSkillId] = useState(0)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [plannedDate, setPlannedDate] = useState(date)
  const [plannedMinutes, setPlannedMinutes] = useState(30)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const firstSkill = skills[0]
    setSkillId(firstSkill?.id ?? 0)
    setTitle('')
    setNote('')
    setPlannedDate(date)
    setPlannedMinutes(firstSkill?.sessionMinutes ?? 30)
    setError('')
  }, [date, open, skills])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  function chooseSkill(nextId: number) {
    setSkillId(nextId)
    const selected = skills.find((skill) => skill.id === nextId)
    if (selected) setPlannedMinutes(selected.sessionMinutes)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        skillId,
        title: title.trim(),
        note: note.trim(),
        plannedDate,
        plannedMinutes,
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '创建学习计划失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="task-dialog study-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-item-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-accent" />
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">学习安排</span>
            <h2 id="study-item-dialog-title">为这一天留出一点时间</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <form className="task-form" onSubmit={submit}>
          <label className="form-field">
            <span>学习技能</span>
            <select value={skillId} onChange={(event) => chooseSkill(Number(event.target.value))}>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>这次学什么</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：练习 20 分钟商务口语"
              maxLength={120}
            />
          </label>
          <label className="form-field">
            <span>补充说明</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="教材、章节或希望达成的结果"
              maxLength={1000}
            />
          </label>
          <div className="form-grid">
            <label className="form-field">
              <span>计划日期</span>
              <input
                type="date"
                value={plannedDate}
                onChange={(event) => setPlannedDate(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>计划时长</span>
              <select
                value={plannedMinutes}
                onChange={(event) => setPlannedMinutes(Number(event.target.value))}
              >
                <option value={15}>15 分钟</option>
                <option value={25}>25 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={45}>45 分钟</option>
                <option value={60}>60 分钟</option>
              </select>
            </label>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="dialog-actions">
            <button className="button button-ghost" type="button" onClick={onClose}>取消</button>
            <button
              className="button button-primary"
              type="submit"
              disabled={saving || !title.trim() || !skillId}
            >
              {saving ? '创建中…' : '加入计划'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
