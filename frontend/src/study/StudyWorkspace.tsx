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
  reflowStudyItems,
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

const TIMER_STORAGE_KEY = 'flowboard.study.timer.v1'

function loadStoredTimer(userId: number): ActiveStudyTimer | null {
  try {
    const value = window.localStorage.getItem(`${TIMER_STORAGE_KEY}.${userId}`)
    if (!value) return null
    const timer = JSON.parse(value) as ActiveStudyTimer
    if (!timer.item?.id) return null
    if (timer.running && timer.startedAt) {
      timer.seconds = Math.max(
        timer.seconds,
        Math.floor((Date.now() - timer.startedAt) / 1000),
      )
    }
    return timer
  } catch {
    return null
  }
}

export function StudyWorkspace({
  user,
  onLogout,
  onSessionExpired,
}: StudyWorkspaceProps) {
  const timerStorageKey = `${TIMER_STORAGE_KEY}.${user.id}`
  const today = localIsoDate()
  const currentWeekStart = weekStartIso()
  const currentWeekEnd = addDays(currentWeekStart, 6)
  const [selectedWeekStart, setSelectedWeekStart] = useState(currentWeekStart)
  const selectedWeekEnd = addDays(selectedWeekStart, 6)
  const [view, setView] = useState<StudyView>('today')
  const [skills, setSkills] = useState<StudySkill[]>([])
  const [currentItems, setCurrentItems] = useState<StudyItem[]>([])
  const [selectedItems, setSelectedItems] = useState<StudyItem[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyItemId, setBusyItemId] = useState<number | null>(null)
  const [busySkillId, setBusySkillId] = useState<number | null>(null)
  const [skillDialogOpen, setSkillDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<StudySkill | null>(null)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemDate, setItemDate] = useState(today)
  const [timer, setTimer] = useState<ActiveStudyTimer | null>(() => loadStoredTimer(user.id))

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
      await reflowStudyItems()
      const selectedRequest = selectedWeekStart === currentWeekStart
        ? Promise.resolve<StudyItem[]>([])
        : listStudyItems(selectedWeekStart, selectedWeekEnd)
      const [nextSkills, nextCurrentItems, nextSelectedItems, nextSessions] = await Promise.all([
        listStudySkills(),
        listStudyItems(currentWeekStart, currentWeekEnd),
        selectedRequest,
        listStudySessions(addDays(today, -30), currentWeekEnd),
      ])
      setSkills(nextSkills)
      setCurrentItems(nextCurrentItems)
      setSelectedItems(selectedWeekStart === currentWeekStart ? nextCurrentItems : nextSelectedItems)
      setSessions(nextSessions)
      setError('')
    } catch (caught) {
      handleError(caught, '无法同步学习计划，请确认后端和数据库已启动。')
    } finally {
      setLoading(false)
    }
  }, [currentWeekEnd, currentWeekStart, handleError, selectedWeekEnd, selectedWeekStart, today])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!timer?.running) return
    const tick = () => {
      setTimer((current) => {
        if (!current?.running || !current.startedAt) return current
        return {
          ...current,
          seconds: Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000)),
        }
      })
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [timer?.running, timer?.startedAt])

  useEffect(() => {
    if (timer) {
      window.localStorage.setItem(timerStorageKey, JSON.stringify(timer))
    } else {
      window.localStorage.removeItem(timerStorageKey)
    }
  }, [timer, timerStorageKey])

  const activeSkills = skills.filter((skill) => !skill.archived)
  const schedulableSkills = activeSkills.filter((skill) => skill.active)

  function openCreateSkill() {
    setEditingSkill(null)
    setSkillDialogOpen(true)
  }

  function openEditSkill(skill: StudySkill) {
    setEditingSkill(skill)
    setSkillDialogOpen(true)
  }

  function openCreateItem(date = today) {
    if (schedulableSkills.length === 0) {
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
      await generateStudyWeek(created.id, currentWeekStart)
    }
    await loadData()
  }

  async function removeSkill(skill: StudySkill) {
    if (!window.confirm(`“${skill.name}”会从技能列表移除，已经排好的计划和学习记录都会保留。确定移除吗？`)) return
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
    if (!skill.active) {
      setError('这项技能已停止排期，请先恢复排期。')
      return
    }
    setBusySkillId(skill.id)
    try {
      const generated = await generateStudyWeek(skill.id, currentWeekStart)
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
      await completeStudyItem(item.id, Math.min(600, Math.max(1, minutes)))
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
    setTimer({ item, seconds: 0, running: true, startedAt: Date.now() })
  }

  function toggleTimer() {
    setTimer((current) => {
      if (!current) return current
      if (current.running) {
        return {
          ...current,
          running: false,
          startedAt: null,
        }
      }
      return {
        ...current,
        running: true,
        startedAt: Date.now() - current.seconds * 1000,
      }
    })
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
    (session) => session.studiedOn >= currentWeekStart && session.studiedOn <= currentWeekEnd,
  )
  const selectedSessions = sessions.filter(
    (session) => session.studiedOn >= selectedWeekStart && session.studiedOn <= selectedWeekEnd,
  )

  function moveWeek(offset: number) {
    setSelectedWeekStart((current) => addDays(current, offset * 7))
  }

  return (
    <div className="study-app-shell">
      <aside className="study-sidebar">
        <div>
          <a className="brand" href="/" aria-label="轻学计划首页">
            <span className="brand-mark"><span /><span /><span /></span>
            <span>轻学计划</span>
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

        {loading && activeSkills.length === 0 ? (
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
                weekStart={currentWeekStart}
                skills={skills}
                items={currentItems}
                sessions={sessions}
                timer={timer}
                busyItemId={busyItemId}
                onCreateSkill={openCreateSkill}
                onCreateItem={() => openCreateItem(today)}
                onStart={startTimer}
                onToggleTimer={toggleTimer}
                onFinishTimer={() => void finishTimer()}
                onQuickComplete={(item) => void completeItem(item)}
                onSkip={(item) => void skipItem(item)}
              />
            )}
            {view === 'skills' && (
              <SkillsView
                skills={activeSkills}
                items={currentItems}
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
                weekStart={selectedWeekStart}
                today={today}
                skills={skills}
                items={selectedItems}
                busyItemId={busyItemId}
                onAddItem={openCreateItem}
                onComplete={(item) => void completeItem(item)}
                onSkip={(item) => void skipItem(item)}
                onPrevious={() => moveWeek(-1)}
                onNext={() => moveWeek(1)}
                onCurrent={() => setSelectedWeekStart(currentWeekStart)}
              />
            )}
            {view === 'review' && (
              <ReviewView
                today={today}
                weekStart={selectedWeekStart}
                skills={skills}
                sessions={selectedSessions}
                items={selectedItems}
                onPrevious={() => moveWeek(-1)}
                onNext={() => moveWeek(1)}
                onCurrent={() => setSelectedWeekStart(currentWeekStart)}
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
        skills={schedulableSkills}
        onClose={() => setItemDialogOpen(false)}
        onSave={saveItem}
      />

      {view === 'plan' && selectedItems.length > 0 && (
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
