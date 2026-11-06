import type { CSSProperties } from 'react'
import { ChartIcon } from '../icons'
import type { StudyItem, StudySession, StudySkill } from './studyTypes'
import {
  addDays,
  formatDay,
  formatMinutes,
  skillMinutesThisWeek,
  studyStreak,
} from './studyUtils'

interface ReviewViewProps {
  today: string
  weekStart: string
  skills: StudySkill[]
  sessions: StudySession[]
  items: StudyItem[]
}

export function ReviewView({
  today,
  weekStart,
  skills,
  sessions,
  items,
}: ReviewViewProps) {
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0)
  const targetMinutes = skills.reduce((sum, skill) => sum + skill.weeklyMinutes, 0)
  const dailyMinutes = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    return {
      date,
      minutes: sessions
        .filter((session) => session.studiedOn === date)
        .reduce((sum, session) => sum + session.durationMinutes, 0),
    }
  })
  const maxMinutes = Math.max(1, ...dailyMinutes.map((entry) => entry.minutes))
  const activeDays = new Set(sessions.map((session) => session.studiedOn)).size
  const doneItems = items.filter((item) => item.status === 'DONE').length
  const completionRate = items.length === 0 ? 0 : Math.round((doneItems / items.length) * 100)
  const streak = studyStreak(sessions, today)

  return (
    <div>
      <header className="study-page-heading">
        <div>
          <span className="study-date">和自己核对一周</span>
          <h1>看见投入，而不只看见结果。</h1>
          <p>学习计划不是考核表。复盘真实时间，给下一周一个更合适的节奏。</p>
        </div>
      </header>

      <section className="review-metrics">
        <article>
          <span>本周专注</span>
          <strong>{formatMinutes(totalMinutes)}</strong>
          <small>目标 {formatMinutes(targetMinutes)}</small>
        </article>
        <article>
          <span>有效学习日</span>
          <strong>{activeDays} 天</strong>
          <small>比“每天都学”更现实</small>
        </article>
        <article>
          <span>计划完成率</span>
          <strong>{completionRate}%</strong>
          <small>{doneItems} / {items.length} 项完成</small>
        </article>
        <article>
          <span>连续学习</span>
          <strong>{streak} 天</strong>
          <small>中断后仍可继续</small>
        </article>
      </section>

      <div className="review-grid">
        <section className="review-chart">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">RHYTHM</span>
              <h2>每天的投入</h2>
            </div>
            <ChartIcon />
          </div>
          <div className="bar-chart" aria-label="每日学习分钟数">
            {dailyMinutes.map((entry) => (
              <div className="bar-column" key={entry.date}>
                <span className="bar-value">{entry.minutes > 0 ? entry.minutes : ''}</span>
                <div className="bar-track">
                  <span style={{ height: `${Math.max(3, (entry.minutes / maxMinutes) * 100)}%` }} />
                </div>
                <small>{formatDay(entry.date).replace('周', '')}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="skill-review">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">BALANCE</span>
              <h2>时间分配</h2>
            </div>
          </div>
          <div className="skill-review-list">
            {skills.map((skill) => {
              const minutes = skillMinutesThisWeek(skill.id, sessions)
              const percent = totalMinutes === 0 ? 0 : Math.round((minutes / totalMinutes) * 100)
              return (
                <article
                  key={skill.id}
                  style={{ '--skill-accent': skill.accent } as CSSProperties}
                >
                  <div>
                    <span className="skill-color" />
                    <strong>{skill.name}</strong>
                    <span>{formatMinutes(minutes)} · {percent}%</span>
                  </div>
                  <div className="skill-progress"><span style={{ width: `${percent}%` }} /></div>
                </article>
              )
            })}
            {skills.length === 0 && <p className="review-empty">添加技能并完成一次学习后，这里会出现投入分布。</p>}
          </div>
        </section>
      </div>

      <section className="weekly-note">
        <span>本周提醒</span>
        <p>
          {totalMinutes === 0
            ? '还没有学习记录。下一次只需要打开计时器，专注 15 分钟。'
            : completionRate < 50
              ? '计划完成得不多，可能是本周安排偏满。下一周可以主动减少一次安排。'
              : '你正在形成稳定节奏。继续保持当前预算，不需要急着增加更多任务。'}
        </p>
      </section>
    </div>
  )
}
