import { useEffect, useState } from 'react'
import { ApiError, getCurrentUser, logout } from './api'
import { AuthPage } from './AuthPage'
import { StudyWorkspace } from './study/StudyWorkspace'
import type { AuthUser } from './types'

export default function StudyApp() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState('')

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((caught) => {
        if (!(caught instanceof ApiError) || caught.status !== 401) {
          setBootError('无法连接学习服务，请确认 MySQL 和 Redis 已启动。')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
    }
  }

  if (loading) {
    return (
      <main className="app-loading">
        <span className="brand-mark"><span /><span /><span /></span>
        <p>正在整理你的学习节奏…</p>
      </main>
    )
  }

  if (!user) {
    return <AuthPage bootError={bootError} onAuthenticated={setUser} />
  }

  return (
    <StudyWorkspace
      user={user}
      onLogout={() => void handleLogout()}
      onSessionExpired={() => setUser(null)}
    />
  )
}

