import type { CSSProperties } from 'react'
import { CheckIcon, PlusIcon } from '../icons'
import type { StudyItem, StudySkill } from './studyTypes'
import { addDays, formatDay } from './studyUtils'

interface PlanViewProps {
  weekStart: string
  today: string
  skills: StudySkill[]
  items: StudyItem[]
  busyItemId: number | null
  onAddItem: (date: string) => void
  onComplete: (item: StudyItem) => void
  onSkip: (item: StudyItem) => void
  onPrevious: () => void
  onNext: () => void
  onCurrent: () => void
}

export function PlanView({
  weekStart,
  today,
  skills,
  items,
  busyItemId,
  onAddItem,
  onComplete,
  onSkip,
  onPrevious,
  onNext,
  onCurrent,
}: PlanViewProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const totalMinutes = items.reduce((sum, item) => sum + item.plannedMinutes, 0)
  const doneItems = items.filter((item) => item.status === 'DONE').length

  return (
    <div>
      <header className="study-page-heading">
        <div>
          <span className="study-date">{formatDay(weekStart)} — {formatDay(addDays(weekStart, 6))}</span>
          <h1>这一周，不追赶，只安排。</h1>
          <p>把时间放进日程里，而不是留给“有空再说”。</p>
        </div>
        <div className="study-week-actions">
          <div className="study-week-switcher">
            <button type="button" onClick={onPrevious} aria-label="上一周">←</button>
            <button type="button" onClick={onCurrent}>本周</button>
            <button type="button" onClick={onNext} aria-label="下一周">→</button>
          </div>
          <button className="button button-primary" type="button" onClick={() => onAddItem(today)}>
            <PlusIcon />
            添加安排
          </button>
        </div>
      </header>

      <section className="week-summary">
        <span><strong>{items.length}</strong> 项安排</span>
        <span><strong>{totalMinutes}</strong> 分钟计划</span>
        <span><strong>{doneItems}</strong> 项已完成</span>
        <span><strong>{skills.length}</strong> 项技能并行</span>
      </section>

      <section className="week-scroll" aria-label="每周学习计划">
        <div className="week-grid">
          {days.map((date) => {
            const dayItems = items.filter((item) => item.plannedDate === date)
            const isToday = date === today
            return (
              <section className={`week-day ${isToday ? 'is-today' : ''}`} key={date}>
                <header>
                  <span>{formatDay(date)}</span>
                  {isToday && <em>今天</em>}
                  <button type="button" onClick={() => onAddItem(date)} aria-label={`在 ${formatDay(date)} 添加学习安排`}>
                    <PlusIcon />
                  </button>
                </header>
                <div className="week-day-items">
                  {dayItems.length > 0 ? dayItems.map((item) => {
                    const skill = skills.find((entry) => entry.id === item.skillId)
                    return (
                      <article
                        key={item.id}
                        className={`week-item status-${item.status.toLowerCase()}`}
                        style={{ '--skill-accent': skill?.accent ?? '#DBFF73' } as CSSProperties}
                      >
                        <span className="week-item-skill">{skill?.name ?? '学习'}</span>
                        <h3>{item.title}</h3>
                        <span>{item.plannedMinutes} 分钟</span>
                        {item.status === 'PLANNED' && item.plannedDate > today ? (
                          <span className="week-item-status">待到计划日期</span>
                        ) : item.status === 'PLANNED' ? (
                          <div className="week-item-actions">
                            <button
                              type="button"
                              onClick={() => onComplete(item)}
                              disabled={busyItemId === item.id}
                            >
                              完成
                            </button>
                            <button
                              type="button"
                              onClick={() => onSkip(item)}
                              disabled={busyItemId === item.id}
                            >
                              跳过
                            </button>
                          </div>
                        ) : (
                          <span className="week-item-status">
                            {item.status === 'DONE' ? <><CheckIcon /> 已完成</> : '已跳过'}
                          </span>
                        )}
                      </article>
                    )
                  }) : (
                    <button className="week-empty-slot" type="button" onClick={() => onAddItem(date)}>
                      留白，也很好
                    </button>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </div>
  )
}
