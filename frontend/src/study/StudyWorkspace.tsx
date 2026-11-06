import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  completeStudyItem,
  createStudyItem,
  createStudySkill,
  deleteStudySkill,
  generateStudyWeek,
  listStudyItems,
  listStudySessions,
  listStudySkills,
  skipStudyItem,
  updateStudySkill,
} from '../api'
import {
  BookIcon,
  CalendarIcon,
  ChartIcon,
  HomeIcon,
  PlusIcon,
} from '../icons'
import type { AuthUser } from '../types'
import { PlanView } from './PlanView'
import { ReviewView } from './ReviewView'
import { SkillDialog } from './SkillDialog'
import { SkillsView } from './SkillsView'
import { StudyItemDialog } from './StudyItemDialog'
import type {
  SkillInput,
  StudyItem,
  StudyItemInput,
  StudySession,
  StudySkill,
  StudyView,
} from './studyTypes'
import { addDays, localIsoDate, weekStartIso } from './studyUtils'
import { TodayView, type ActiveStudyTimer } from './TodayView'

interface StudyWorkspaceProps {
  user: AuthUser
  onLogout: () => void
  onSessionExpired: () => void
}

const navItems: Array<{
  id: StudyView
  label: string
  icon: typeof HomeIcon
}> = [
  { id: 'today', label: '今日学习', icon: HomeIcon },
  { id: 'skills', label: '我的技能', icon: BookIcon },
  { id: 'plan', label: '本周计划', icon: CalendarIcon },
  { id: 'review', label: '学习复盘', icon: ChartIcon },
]

export function StudyWorkspace({
  user,
  onLogout,
  onSessionExpired,
}: StudyWorkspaceProps) {
  const today = localIsoDate()
  const weekStart = weekStartIso()
  const weekEnd = addDays(weekStart, 6)
  const [view, setView] = useState<StudyView>('today')
  const [skills, setSkills] = useState<StudySkill[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyItemId, setBusyItemId] = useState<number | null>(null)
  const [busySkillId, setBusySkillId] = useState<number | null>(null)
  const [skillDialogOpen, setSkillDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<StudySkill | null>(null)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemDate, setItemDate] = useState(today)
  const [timer, setTimer] = useState<ActiveStudyTimer | null>(null)

  const handleError = useCallback(
    (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.status === 401) {
        onSessionExpired()
        return
      }
      setError(caught instanceof ApiError ? caught.message : fallback)
    },
    [onSessionExpired],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSkills, nextItems, nextSessions] = await Promise.all([
        listStudySkills(),
        listStudyItems(weekStart, weekEnd),
        listStudySessions(addDays(today, -30), weekEnd),
      ])
      setSkills(nextSkills)
      setItems(nextItems)
      setSessions(nextSessions)
      setError('')
    } catch (caught) {
      handleError(caught, '无法同步学习计划，请确认后端和数据库已启动。')
    } finally {
      setLoading(false)
    }
  }, [handleError, today, weekEnd, weekStart])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!timer?.running) return
    const interval = window.setInterval(() => {
      setTimer((current) =>
        current?.running
          ? { ...current, seconds: current.seconds + 1 }
          : current,
      )
    }, 1000)
    return () => window.clearInterval(interval)
  }, [timer?.running])

  function openCreateSkill() {
    setEditingSkill(null)
    setSkillDialogOpen(true)
  }

  function openEditSkill(skill: StudySkill) {
    setEditingSkill(skill)
    setSkillDialogOpen(true)
  }

  function openCreateItem(date = today) {
    if (skills.length === 0) {
      openCreateSkill()
      return
    }
    setItemDate(date)
    setItemDialogOpen(true)
  }

  async function saveSkill(input: SkillInput) {
    if (editingSkill) {
      await updateStudySkill(editingSkill.id, input)
    } else {
      const created = await createStudySkill(input)
      await generateStudyWeek(created.id, weekStart)
    }
    await loadData()
  }

  async function removeSkill(skill: StudySkill) {
    if (!window.confirm(`删除“${skill.name}”会同时删除相关计划，确定继续吗？`)) return
    setBusySkillId(skill.id)
    try {
      await deleteStudySkill(skill.id)
      await loadData()
    } catch (caught) {
      handleError(caught, '删除技能失败')
    } finally {
      setBusySkillId(null)
    }
  }

  async function generatePlan(skill: StudySkill) {
    setBusySkillId(skill.id)
    try {
      const generated = await generateStudyWeek(skill.id, weekStart)
      await loadData()
      if (generated.length === 0) {
        setError('这项技能本周已经有安排，没有重复生成。')
      }
    } catch (caught) {
      handleError(caught, '生成学习计划失败')
    } finally {
      setBusySkillId(null)
    }
  }

  async function saveItem(input: StudyItemInput) {
    await createStudyItem(input)
    await loadData()
  }

  async function completeItem(item: StudyItem, minutes = item.plannedMinutes) {
    setBusyItemId(item.id)
    try {
      await completeStudyItem(item.id, Math.max(1, minutes))
      if (timer?.item.id === item.id) setTimer(null)
      await loadData()
    } catch (caught) {
      handleError(caught, '记录学习失败')
    } finally {
      setBusyItemId(null)
    }
  }

  async function skipItem(item: StudyItem) {
    setBusyItemId(item.id)
    try {
      await skipStudyItem(item.id, '这周先留一点空间')
      if (timer?.item.id === item.id) setTimer(null)
      await loadData()
    } catch (caught) {
      handleError(caught, '更新计划失败')
    } finally {
      setBusyItemId(null)
    }
  }

  function startTimer(item: StudyItem) {
    setTimer({ item, seconds: 0, running: true })
  }

  async function finishTimer() {
    if (!timer) return
    await completeItem(timer.item, Math.max(1, Math.ceil(timer.seconds / 60)))
  }

  function retry() {
    setError('')
    void loadData()
  }

  const weekSessions = sessions.filter(
    (session) => session.studiedOn >= weekStart && session.studiedOn <= weekEnd,
  )

  return (
    <div className="study-app-shell">
      <aside className="study-sidebar">
        <div>
          <a className="brand" href="/" aria-label="Flowboard 学习计划首页">
            <span className="brand-mark"><span /><span /><span /></span>
            <span>flowboard</span>
          </a>
          <p className="study-sidebar-caption">给下班后的你，一条可持续的学习路径。</p>

          <nav className="study-nav" aria-label="学习计划导航">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={view === item.id ? 'active' : ''}
                  type="button"
                  aria-current={view === item.id ? 'page' : undefined}
                  onClick={() => setView(item.id)}
                >
                  <Icon />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="study-sidebar-footer">
          <div className="study-user">
            <span>{user.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </div>
            <button type="button" onClick={onLogout}>退出</button>
          </div>
          <p>不必每天完美，<br />只要在下一周继续。</p>
        </div>
      </aside>

      <main className="study-workspace">
        <nav className="study-mobile-header" aria-label="移动端学习导航">
          <div className="study-mobile-user">
            <span>{user.displayName.slice(0, 1).toUpperCase()}</span>
            <strong>{user.displayName}</strong>
            <button type="button" onClick={onLogout}>退出</button>
          </div>
          <div>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={view === item.id ? 'active' : ''}
                  onClick={() => setView(item.id)}
                  aria-label={item.label}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {error && (
          <div className="study-notice" role="status">
            <span>{error}</span>
            <button type="button" onClick={retry}>重试</button>
          </div>
        )}

        {loading && skills.length === 0 ? (
          <div className="study-loading-grid">
            <div />
            <div />
            <div />
          </div>
        ) : (
          <>
            {view === 'today' && (
              <TodayView
                displayName={user.displayName}
                today={today}
                weekStart={weekStart}
                skills={skills}
                items={items}
                sessions={sessions}
                timer={timer}
                busyItemId={busyItemId}
                onCreateSkill={openCreateSkill}
                onCreateItem={() => openCreateItem(today)}
                onStart={startTimer}
                onToggleTimer={() =>
                  setTimer((current) => current ? { ...current, running: !current.running } : current)
                }
                onFinishTimer={() => void finishTimer()}
                onQuickComplete={(item) => void completeItem(item)}
                onSkip={(item) => void skipItem(item)}
              />
            )}
            {view === 'skills' && (
              <SkillsView
                skills={skills}
                items={items}
                sessions={weekSessions}
                busySkillId={busySkillId}
                onCreate={openCreateSkill}
                onEdit={openEditSkill}
                onGenerate={(skill) => void generatePlan(skill)}
                onDelete={(skill) => void removeSkill(skill)}
              />
            )}
            {view === 'plan' && (
              <PlanView
                weekStart={weekStart}
                today={today}
                skills={skills}
                items={items}
                busyItemId={busyItemId}
                onAddItem={openCreateItem}
                onComplete={(item) => void completeItem(item)}
                onSkip={(item) => void skipItem(item)}
              />
            )}
            {view === 'review' && (
              <ReviewView
                today={today}
                weekStart={weekStart}
                skills={skills}
                sessions={weekSessions}
                items={items}
              />
            )}
          </>
        )}
      </main>

      <SkillDialog
        open={skillDialogOpen}
        skill={editingSkill}
        onClose={() => setSkillDialogOpen(false)}
        onSave={saveSkill}
      />
      <StudyItemDialog
        open={itemDialogOpen}
        date={itemDate}
        skills={skills}
        onClose={() => setItemDialogOpen(false)}
        onSave={saveItem}
      />

      {view === 'plan' && items.length > 0 && (
        <button
          className="study-mobile-add"
          type="button"
          onClick={() => openCreateItem(today)}
          aria-label="添加学习安排"
        >
          <PlusIcon />
        </button>
      )}
      {view === 'today' && (
        <span className="sr-only" aria-live="polite">
          {timer ? `正在学习 ${timer.item.title}` : ''}
        </span>
      )}
    </div>
  )
}
