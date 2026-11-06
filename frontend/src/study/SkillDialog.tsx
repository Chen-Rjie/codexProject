import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api'
import type { SkillInput, StudySkill } from './studyTypes'

interface SkillDialogProps {
  open: boolean
  skill: StudySkill | null
  onClose: () => void
  onSave: (input: SkillInput) => Promise<void>
}

const accents = ['#DBFF73', '#8EA7FF', '#FFAB91', '#7DD3B0', '#E9C46A']

export function SkillDialog({ open, skill, onClose, onSave }: SkillDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [accent, setAccent] = useState(accents[0])
  const [weeklyMinutes, setWeeklyMinutes] = useState(180)
  const [sessionMinutes, setSessionMinutes] = useState(30)
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(skill?.name ?? '')
    setDescription(skill?.description ?? '')
    setAccent(skill?.accent ?? accents[0])
    setWeeklyMinutes(skill?.weeklyMinutes ?? 180)
    setSessionMinutes(skill?.sessionMinutes ?? 30)
    setSessionsPerWeek(skill?.sessionsPerWeek ?? 3)
    setError('')
  }, [open, skill])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        accent,
        weeklyMinutes,
        sessionMinutes,
        sessionsPerWeek,
        active: skill?.active ?? true,
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '保存技能失败')
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
        aria-labelledby="skill-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-accent" style={{ background: accent }} />
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">学习技能</span>
            <h2 id="skill-dialog-title">{skill ? '调整学习节奏' : '添加一项想坚持的技能'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <form className="task-form" onSubmit={submit}>
          <label className="form-field">
            <span>技能名称</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：英语口语、Java、产品设计"
              maxLength={80}
            />
          </label>
          <label className="form-field">
            <span>一句话目标</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="希望在什么场景中用上这项技能？"
              maxLength={500}
            />
          </label>

          <div className="form-grid">
            <label className="form-field">
              <span>每周投入</span>
              <select
                value={weeklyMinutes}
                onChange={(event) => setWeeklyMinutes(Number(event.target.value))}
              >
                <option value={60}>1 小时</option>
                <option value={120}>2 小时</option>
                <option value={180}>3 小时</option>
                <option value={300}>5 小时</option>
                <option value={420}>7 小时</option>
              </select>
            </label>
            <label className="form-field">
              <span>单次时长</span>
              <select
                value={sessionMinutes}
                onChange={(event) => setSessionMinutes(Number(event.target.value))}
              >
                <option value={15}>15 分钟</option>
                <option value={25}>25 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={45}>45 分钟</option>
                <option value={60}>60 分钟</option>
              </select>
            </label>
            <label className="form-field form-field-wide">
              <span>每周安排次数</span>
              <select
                value={sessionsPerWeek}
                onChange={(event) => setSessionsPerWeek(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                  <option key={count} value={count}>{count} 次</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="accent-picker">
            <legend>标记颜色</legend>
            <div>
              {accents.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={accent === color ? 'selected' : ''}
                  style={{ background: color }}
                  onClick={() => setAccent(color)}
                  aria-label={`选择颜色 ${color}`}
                />
              ))}
            </div>
          </fieldset>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="dialog-actions">
            <button className="button button-ghost" type="button" onClick={onClose}>取消</button>
            <button
              className="button button-primary"
              type="submit"
              disabled={saving || !name.trim()}
            >
              {saving ? '保存中…' : skill ? '保存修改' : '添加技能'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

