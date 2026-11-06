import type { CSSProperties } from 'react'
import {
  CheckIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
} from '../icons'
import type { StudyItem, StudySession, StudySkill } from './studyTypes'
import { addDays, formatMinutes, skillMinutesThisWeek, studyStreak } from './studyUtils'

export interface ActiveStudyTimer {
  item: StudyItem
  seconds: number
  running: boolean
  startedAt: number | null
}

interface TodayViewProps {
  displayName: string
  today: string
  weekStart: string
  skills: StudySkill[]
  items: StudyItem[]
  sessions: StudySession[]
  timer: ActiveStudyTimer | null
  busyItemId: number | null
  onCreateSkill: () => void
  onCreateItem: () => void
  onStart: (item: StudyItem) => void
  onToggleTimer: () => void
  onFinishTimer: () => void
  onQuickComplete: (item: StudyItem) => void
  onSkip: (item: StudyItem) => void
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function TodayView({
  displayName,
  today,
  weekStart,
  skills,
  items,
  sessions,
  timer,
  busyItemId,
  onCreateSkill,
  onCreateItem,
  onStart,
  onToggleTimer,
  onFinishTimer,
  onQuickComplete,
  onSkip,
}: TodayViewProps) {
  const todayItems = items.filter((item) => item.plannedDate === today)
  const completed = todayItems.filter((item) => item.status === 'DONE')
  const plannedMinutes = todayItems.reduce((sum, item) => sum + item.plannedMinutes, 0)
  const doneMinutes = sessions
    .filter((session) => session.studiedOn === today)
    .reduce((sum, session) => sum + session.durationMinutes, 0)
  const progress = todayItems.length === 0 ? 0 : Math.round((completed.length / todayItems.length) * 100)
  const streak = studyStreak(sessions, today)
  const weekEndIso = addDays(weekStart, 6)
  const weekSessions = sessions.filter(
    (session) => session.studiedOn >= weekStart && session.studiedOn <= weekEndIso,
  )
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${today}T00:00:00`))

  if (skills.length === 0) {
    return (
      <section className="study-empty-state">
        <span className="study-empty-mark">01</span>
        <h1>{displayName}，先从一项真正想学的技能开始。</h1>
        <p>不用一次安排满一周。选择技能、给出每周时间预算，我们会把它拆成可以完成的小步。</p>
        <button className="button button-primary" type="button" onClick={onCreateSkill}>
          <PlusIcon />
          添加第一项技能
        </button>
      </section>
    )
  }

  return (
    <div className="today-view">
      <header className="study-page-heading">
        <div>
          <span className="study-date">{dateLabel}</span>
          <h1>{displayName}，今晚留一点时间给自己。</h1>
          <p>完成最重要的一个小节就够了，稳定比冲刺更有价值。</p>
        </div>
        <button className="button button-primary" type="button" onClick={onCreateItem}>
          <PlusIcon />
          添加学习安排
        </button>
      </header>

      <section className="today-focus-grid">
        <article className="daily-progress">
          <div
            className="progress-dial"
            style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}
          >
            <div>
              <strong>{progress}%</strong>
              <span>今日完成</span>
            </div>
          </div>
          <div className="daily-progress-copy">
            <span>今天的学习</span>
            <h2>{completed.length} / {todayItems.length} 项已完成</h2>
            <p>
              计划投入 {plannedMinutes} 分钟
              {doneMinutes > 0 ? `，已经专注 ${formatMinutes(doneMinutes)}` : '，从最容易开始的一项入手。'}
            </p>
          </div>
        </article>

        <article className="streak-panel">
          <span className="streak-number">{String(streak).padStart(2, '0')}</span>
          <div>
            <span>连续学习天数</span>
            <strong>{streak > 0 ? '节奏正在形成' : '今天就是新的起点'}</strong>
            <p>偶尔中断不会清空总进度，重新排回本周即可。</p>
          </div>
        </article>
      </section>

      {timer && (
        <section className="focus-timer" aria-label="当前学习计时">
          <div className="focus-timer-pulse" />
          <div>
            <span>正在专注</span>
            <h2>{timer.item.title}</h2>
          </div>
          <strong className="timer-digits">{formatTimer(timer.seconds)}</strong>
          <div className="timer-actions">
            <button className="button button-ghost" type="button" onClick={onToggleTimer}>
              {timer.running ? <PauseIcon /> : <PlayIcon />}
              {timer.running ? '暂停' : '继续'}
            </button>
            <button className="button button-primary" type="button" onClick={onFinishTimer}>
              <CheckIcon />
              完成并记录
            </button>
          </div>
        </section>
      )}

      <div className="today-content-grid">
        <section className="today-agenda" aria-label="今日学习清单">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">TODAY</span>
              <h2>今天学什么</h2>
            </div>
            <span>{todayItems.length} 项安排</span>
          </div>

          {todayItems.length === 0 ? (
            <button className="agenda-empty" type="button" onClick={onCreateItem}>
              <span className="agenda-empty-plus">+</span>
              <strong>今天还没有安排</strong>
              <span>加入一个 15 分钟的轻量任务，让节奏继续。</span>
            </button>
          ) : (
            <div className="agenda-list">
              {todayItems.map((item) => {
                const skill = skills.find((entry) => entry.id === item.skillId)
                const isActive = timer?.item.id === item.id
                return (
                  <article
                    key={item.id}
                    className={`agenda-row status-${item.status.toLowerCase()}`}
                    style={{ '--skill-accent': skill?.accent ?? '#DBFF73' } as CSSProperties}
                  >
                    <span className="agenda-accent" />
                    <div className="agenda-copy">
                      <span>{skill?.name ?? '学习技能'} · {item.plannedMinutes} 分钟</span>
                      <h3>{item.title}</h3>
                      {item.note && <p>{item.note}</p>}
                    </div>
                    <div className="agenda-actions">
                      {item.status === 'PLANNED' && !isActive && (
                        <>
                          <button
                            className="agenda-secondary"
                            type="button"
                            onClick={() => onQuickComplete(item)}
                            disabled={busyItemId === item.id}
                          >
                            直接完成
                          </button>
                          <button className="agenda-primary" type="button" onClick={() => onStart(item)}>
                            <PlayIcon />
                            开始专注
                          </button>
                        </>
                      )}
                      {item.status === 'PLANNED' && (
                        <button
                          className="agenda-skip"
                          type="button"
                          onClick={() => onSkip(item)}
                          disabled={busyItemId === item.id}
                        >
                          跳过
                        </button>
                      )}
                      {item.status === 'DONE' && <span className="done-stamp"><CheckIcon /> 已完成</span>}
                      {item.status === 'SKIPPED' && <span className="skipped-stamp">已跳过</span>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="skill-pulse" aria-label="本周技能投入">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">SKILLS</span>
              <h2>本周投入</h2>
            </div>
            <button type="button" onClick={onCreateSkill} aria-label="添加技能"><PlusIcon /></button>
          </div>
          <div className="pulse-list">
            {skills.map((skill) => {
              const minutes = skillMinutesThisWeek(skill.id, weekSessions)
              const percent = Math.min(100, Math.round((minutes / skill.weeklyMinutes) * 100))
              return (
                <article
                  key={skill.id}
                  style={{ '--skill-accent': skill.accent } as CSSProperties}
                >
                  <div>
                    <span className="skill-color" />
                    <strong>{skill.name}</strong>
                    <span>{minutes} / {skill.weeklyMinutes} 分钟</span>
                  </div>
                  <div className="skill-progress"><span style={{ width: `${percent}%` }} /></div>
                </article>
              )
            })}
          </div>
          <div className="today-reminder">
            <ClockIcon />
            <p>下班后的注意力有限，优先完成今天计划最轻的一项。</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
