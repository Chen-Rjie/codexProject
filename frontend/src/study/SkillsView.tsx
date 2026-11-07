import type { CSSProperties } from 'react'
import { ArrowIcon, EditIcon, PlusIcon, SparkIcon, TrashIcon } from '../icons'
import type { StudyItem, StudySession, StudySkill } from './studyTypes'
import { formatMinutes, skillMinutesThisWeek } from './studyUtils'

interface SkillsViewProps {
  skills: StudySkill[]
  items: StudyItem[]
  sessions: StudySession[]
  busySkillId: number | null
  onCreate: () => void
  onEdit: (skill: StudySkill) => void
  onGenerate: (skill: StudySkill) => void
  onDelete: (skill: StudySkill) => void
}

export function SkillsView({
  skills,
  items,
  sessions,
  busySkillId,
  onCreate,
  onEdit,
  onGenerate,
  onDelete,
}: SkillsViewProps) {
  const totalTarget = skills.reduce((sum, skill) => sum + skill.weeklyMinutes, 0)
  const totalDone = sessions.reduce((sum, session) => sum + session.durationMinutes, 0)

  return (
    <div>
      <header className="study-page-heading">
        <div>
          <span className="study-date">多线学习，也要留出呼吸</span>
          <h1>你的技能组合。</h1>
          <p>同时学习不等于同时推进。给每项技能一个真实可承受的每周预算。</p>
        </div>
        <button className="button button-primary" type="button" onClick={onCreate}>
          <PlusIcon />
          添加技能
        </button>
      </header>

      {skills.length === 0 ? (
        <section className="study-empty-state compact">
          <span className="study-empty-mark">02</span>
          <h2>还没有正在学习的技能</h2>
          <p>从一个最想提升、也最愿意在下班后投入的项目开始。</p>
          <button className="button button-primary" type="button" onClick={onCreate}>
            <PlusIcon />
            添加技能
          </button>
        </section>
      ) : (
        <>
          <section className="skills-summary-strip">
            <div>
              <span>技能数量</span>
              <strong>{skills.length}</strong>
            </div>
            <div>
              <span>本周计划</span>
              <strong>{formatMinutes(totalTarget)}</strong>
            </div>
            <div>
              <span>本周已投入</span>
              <strong>{formatMinutes(totalDone)}</strong>
            </div>
            <div>
              <span>整体达成</span>
              <strong>{totalTarget ? Math.round((totalDone / totalTarget) * 100) : 0}%</strong>
            </div>
          </section>

          <section className="skill-card-grid" aria-label="学习技能列表">
            {skills.map((skill, index) => {
              const minutes = skillMinutesThisWeek(skill.id, sessions)
              const percent = Math.min(100, Math.round((minutes / skill.weeklyMinutes) * 100))
              const plannedCount = items.filter(
                (item) => item.skillId === skill.id && item.status === 'PLANNED',
              ).length
              return (
                <article
                  key={skill.id}
                  className="skill-card"
                  style={{ '--skill-accent': skill.accent } as CSSProperties}
                >
                  <div className="skill-card-top">
                    <span className="skill-index">0{index + 1}</span>
                    <div className="skill-card-actions">
                      <button type="button" onClick={() => onEdit(skill)} aria-label={`编辑 ${skill.name}`}>
                        <EditIcon />
                      </button>
                      <button type="button" onClick={() => onDelete(skill)} aria-label={`移除 ${skill.name}`}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <div className="skill-title-row">
                    <span className="skill-color large" />
                    <h2>{skill.name}</h2>
                  </div>
                  <p>{skill.description || '还没有填写目标，先保持稳定投入。'}</p>
                  <div className="skill-target-row">
                    <span>{minutes} / {skill.weeklyMinutes} 分钟</span>
                    <strong>{percent}%</strong>
                  </div>
                  <div className="skill-progress large"><span style={{ width: `${percent}%` }} /></div>
                  <div className="skill-card-meta">
                    <span>{skill.sessionsPerWeek} 次 / 周</span>
                    <span>每次 {skill.sessionMinutes} 分钟</span>
                    <span>{plannedCount} 项待完成</span>
                  </div>
                  <button
                    className="skill-generate"
                    type="button"
                    onClick={() => onGenerate(skill)}
                    disabled={busySkillId === skill.id || !skill.active}
                  >
                    <SparkIcon />
                    {busySkillId === skill.id ? '正在安排…' : skill.active ? '生成本周计划' : '已停止排期'}
                    <ArrowIcon />
                  </button>
                </article>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}
