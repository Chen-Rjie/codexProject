import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ApiError,
  checkHealth,
  createTask,
  deleteTask,
  getCurrentUser,
  listTasks,
  logout,
  updateTask,
} from './api'
import { AuthPage } from './AuthPage'
import {
  AlertIcon,
  ArrowIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
} from './icons'
import { TaskCard } from './TaskCard'
import { TaskDialog } from './TaskDialog'
import {
  statusMeta,
  type AuthUser,
  type Task,
  type TaskFilters,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from './types'

const boardColumns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

const initialFilters: TaskFilters = {
  search: '',
  status: '',
  priority: '',
}

type WorkspaceView = 'board' | 'all'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [bootError, setBootError] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('board')
  const [filters, setFilters] = useState<TaskFilters>(initialFilters)
  const deferredSearch = useDeferredValue(filters.search)
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogStatus, setDialogStatus] = useState<TaskStatus>('TODO')

  const visibleFilters = useMemo<TaskFilters>(
    () => ({
      search: deferredSearch,
      status: filters.status,
      priority: filters.priority,
    }),
    [deferredSearch, filters.priority, filters.status],
  )

  const loadVisibleTasks = useCallback(
    async (signal?: AbortSignal) => {
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const nextTasks = await listTasks(visibleFilters, signal)
        setTasks(nextTasks)
        setError('')
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        if (caught instanceof ApiError && caught.status === 401) {
          setUser(null)
          return
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : '无法读取任务，请确认 Java 后端已在 4000 端口启动。',
        )
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [user, visibleFilters],
  )

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    void loadVisibleTasks(controller.signal)
    return () => controller.abort()
  }, [loadVisibleTasks, user])

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((caught) => {
        if (!(caught instanceof ApiError) || caught.status !== 401) {
          setBootError('无法连接后端服务，请确认 MySQL 和 Redis 已启动。')
        }
      })
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (!user) {
      setApiOnline(null)
      return
    }
    checkHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
  }, [user])

  const stats = useMemo(
    () => ({
      total: tasks.length,
      progress: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
      done: tasks.filter((task) => task.status === 'DONE').length,
      high: tasks.filter((task) => task.priority === 'HIGH' && task.status !== 'DONE').length,
    }),
    [tasks],
  )

  function openCreate(status: TaskStatus = 'TODO') {
    setEditingTask(null)
    setDialogStatus(status)
    setDialogOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setDialogStatus(task.status)
    setDialogOpen(true)
  }

  async function saveTask(input: TaskInput) {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, input)
      } else {
        await createTask(input)
      }
      await loadVisibleTasks()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setUser(null)
      throw caught
    }
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    setBusyTaskId(task.id)
    try {
      await updateTask(task.id, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        status,
      })
      await loadVisibleTasks()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setUser(null)
        return
      }
      setError(caught instanceof ApiError ? caught.message : '更新任务失败。')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`确定删除“${task.title}”吗？此操作无法撤销。`)) return
    setBusyTaskId(task.id)
    try {
      await deleteTask(task.id)
      await loadVisibleTasks()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setUser(null)
        return
      }
      setError(caught instanceof ApiError ? caught.message : '删除任务失败。')
    } finally {
      setBusyTaskId(null)
    }
  }

  function resetFilters() {
    setFilters(initialFilters)
  }

  function showAllTasks() {
    resetFilters()
    setWorkspaceView('all')
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
      setTasks([])
      setFilters(initialFilters)
      setError('')
    }
  }

  if (authLoading) {
    return (
      <main className="app-loading">
        <span className="brand-mark">
          <span />
          <span />
          <span />
        </span>
        <p>正在恢复你的工作空间…</p>
      </main>
    )
  }

  if (!user) {
    return <AuthPage bootError={bootError} onAuthenticated={setUser} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <a className="brand" href="/" aria-label="Flowboard 首页">
            <span className="brand-mark">
              <span />
              <span />
              <span />
            </span>
            <span>flowboard</span>
          </a>

          <div className="project-chip">
            <span className="project-avatar">CP</span>
            <div>
              <strong>Codex Project</strong>
              <span>本地开发空间</span>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="主导航">
            <button
              className={`nav-item ${workspaceView === 'board' ? 'active' : ''}`}
              type="button"
              aria-current={workspaceView === 'board' ? 'page' : undefined}
              onClick={() => setWorkspaceView('board')}
            >
              <LayersIcon />
              任务看板
              <span className="nav-count">{stats.total}</span>
            </button>
            <button
              className={`nav-item ${workspaceView === 'all' ? 'active' : ''}`}
              type="button"
              aria-current={workspaceView === 'all' ? 'page' : undefined}
              onClick={showAllTasks}
            >
              <SparkIcon />
              全部任务
              <span className="nav-count">{stats.total}</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-foot">
          <div className="user-card">
            <span className="user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.displayName}</strong>
              <span>@{user.username}</span>
            </div>
            <button type="button" onClick={() => void handleLogout()} aria-label="退出登录">
              退出
            </button>
          </div>
          <div className="focus-card">
            <span className="focus-icon">
              <ArrowIcon />
            </span>
            <p>让每项任务都拥有清晰的下一步。</p>
            <button type="button" onClick={() => openCreate('TODO')}>
              新建第一项任务
            </button>
          </div>
          <div className="stack-label">
            <span>Spring Boot</span>
            <span>React + TS</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <div className="mobile-account-bar">
          <span className="user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.displayName}</strong>
            <span>@{user.username}</span>
          </div>
          <button type="button" onClick={() => void handleLogout()}>
            退出登录
          </button>
        </div>

        <nav className="mobile-view-switch" aria-label="视图切换">
          <button
            className={workspaceView === 'board' ? 'active' : ''}
            type="button"
            onClick={() => setWorkspaceView('board')}
          >
            看板
          </button>
          <button
            className={workspaceView === 'all' ? 'active' : ''}
            type="button"
            onClick={showAllTasks}
          >
            全部任务
          </button>
        </nav>

        <header className="workspace-heading">
          <div>
            <div className="eyebrow-row">
              <span className="eyebrow">工作台 / 本地开发</span>
              <span className={`api-status ${apiOnline ? 'online' : 'offline'}`}>
                <span />
                {apiOnline === null ? '检测服务' : apiOnline ? 'API 已连接' : 'API 未连接'}
              </span>
            </div>
            <h1>{workspaceView === 'board' ? '把计划，推到完成。' : '所有任务，一处掌握。'}</h1>
            <p>
              {workspaceView === 'board'
                ? '聚焦今天最重要的动作，让任务状态和推进节奏一目了然。'
                : '用列表统一查看所有任务，再通过状态、优先级或关键词快速定位。'}
            </p>
          </div>
          <button className="button button-primary create-button" type="button" onClick={() => openCreate()}>
            <PlusIcon />
            新建任务
          </button>
        </header>

        <section className="stats-grid" aria-label="任务概览">
          <article className="stat-card stat-total">
            <span>当前任务</span>
            <strong>{stats.total.toString().padStart(2, '0')}</strong>
            <small>当前筛选范围</small>
          </article>
          <article className="stat-card stat-progress">
            <span>正在进行</span>
            <strong>{stats.progress.toString().padStart(2, '0')}</strong>
            <small>保持推进节奏</small>
          </article>
          <article className="stat-card stat-done">
            <span>已经完成</span>
            <strong>{stats.done.toString().padStart(2, '0')}</strong>
            <small>每一步都有价值</small>
          </article>
          <article className="stat-card stat-high">
            <span>高优先级</span>
            <strong>{stats.high.toString().padStart(2, '0')}</strong>
            <small>需要优先关注</small>
          </article>
        </section>

        <section className="toolbar" aria-label="任务筛选">
          <label className="search-box">
            <SearchIcon />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="搜索任务标题或描述"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => setFilters((current) => ({ ...current, search: '' }))}
              >
                ×
              </button>
            )}
          </label>

          <div className="filter-group">
            <select
              aria-label="按状态筛选"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as TaskStatus | '',
                }))
              }
            >
              <option value="">全部状态</option>
              <option value="TODO">待处理</option>
              <option value="IN_PROGRESS">进行中</option>
              <option value="DONE">已完成</option>
            </select>
            <select
              aria-label="按优先级筛选"
              value={filters.priority}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  priority: event.target.value as TaskPriority | '',
                }))
              }
            >
              <option value="">全部优先级</option>
              <option value="HIGH">高优先级</option>
              <option value="MEDIUM">中优先级</option>
              <option value="LOW">低优先级</option>
            </select>
          </div>
        </section>

        {error && (
          <div className="api-error" role="alert">
            <AlertIcon />
            <div>
              <strong>暂时无法同步任务</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void loadVisibleTasks()}>
              重试
            </button>
          </div>
        )}

        {workspaceView === 'board' ? (
          <section className="board" aria-label="任务看板">
            {boardColumns.map((status) => {
              const meta = statusMeta[status]
              const columnTasks = tasks.filter((task) => task.status === status)
              return (
                <section className={`board-column ${meta.className}`} key={status}>
                  <div className="column-heading">
                    <div>
                      <span className="column-dot" />
                      <h2>{meta.label}</h2>
                      <span className="column-count">{columnTasks.length}</span>
                    </div>
                    <button
                      className="icon-button column-add"
                      type="button"
                      onClick={() => openCreate(status)}
                      aria-label={`在${meta.label}中新建任务`}
                    >
                      <PlusIcon />
                    </button>
                  </div>
                  <p className="column-hint">{meta.hint}</p>

                  <div className="column-tasks">
                    {loading && tasks.length === 0 ? (
                      <>
                        <div className="task-skeleton" />
                        <div className="task-skeleton skeleton-short" />
                      </>
                    ) : columnTasks.length > 0 ? (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          busy={busyTaskId === task.id}
                          onEdit={openEdit}
                          onDelete={removeTask}
                          onChangeStatus={changeStatus}
                        />
                      ))
                    ) : (
                      <button className="empty-column" type="button" onClick={() => openCreate(status)}>
                        <span>+</span>
                        在这里添加任务
                      </button>
                    )}
                  </div>
                </section>
              )
            })}
          </section>
        ) : (
          <section className="all-tasks-view" aria-label="全部任务列表">
            <header className="all-tasks-heading">
              <div>
                <span className="eyebrow">任务总览</span>
                <h2>全部任务</h2>
              </div>
              <span className="all-tasks-count">{tasks.length} 项任务</span>
            </header>

            {loading && tasks.length === 0 ? (
              <div className="all-tasks-grid">
                <div className="task-skeleton" />
                <div className="task-skeleton" />
                <div className="task-skeleton skeleton-short" />
              </div>
            ) : tasks.length > 0 ? (
              <div className="all-tasks-grid">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    busy={busyTaskId === task.id}
                    onEdit={openEdit}
                    onDelete={removeTask}
                    onChangeStatus={changeStatus}
                  />
                ))}
              </div>
            ) : (
              <button className="all-tasks-empty" type="button" onClick={() => openCreate('TODO')}>
                <span>
                  <PlusIcon />
                </span>
                <strong>这里还没有任务</strong>
                <small>创建第一项任务后，它会出现在这个列表中。</small>
              </button>
            )}
          </section>
        )}
      </main>

      <TaskDialog
        open={dialogOpen}
        task={editingTask}
        initialStatus={dialogStatus}
        onClose={() => setDialogOpen(false)}
        onSave={saveTask}
      />
    </div>
  )
}

