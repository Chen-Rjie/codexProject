import { useState, type FormEvent } from 'react'
import { ApiError, login, register } from './api'
import type { AuthUser } from './types'
import { ArrowIcon, LayersIcon, SparkIcon } from './icons'

interface AuthPageProps {
  bootError?: string
  onAuthenticated: (user: AuthUser) => void
}

type Mode = 'login' | 'register'

export function AuthPage({ bootError, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(bootError ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setError('')
    setFieldErrors({})
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setFieldErrors({})

    try {
      const user =
        mode === 'login'
          ? await login({ username: username.trim(), password })
          : await register({
              username: username.trim(),
              displayName: displayName.trim(),
              password,
            })
      onAuthenticated(user)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors(caught.fieldErrors ?? {})
      } else {
        setError('无法连接后端服务，请稍后重试。')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>轻学计划</span>
        </div>

        <div className="auth-story-copy">
          <span className="auth-kicker">多技能 · 轻计划 · 可持续</span>
          <h1>
            让学习节奏
            <br />
            融进下班生活。
          </h1>
          <p>不必每天都学很多。按真实可用时间安排多项技能，让一小步也能长期累积。</p>
        </div>

        <div className="auth-feature-list">
          <div>
            <span><LayersIcon /></span>
            <p><strong>多技能学习</strong>同时规划不同成长方向</p>
          </div>
          <div>
            <span><SparkIcon /></span>
            <p><strong>Redis 会话</strong>登录状态安全持久</p>
          </div>
          <div>
            <span><ArrowIcon /></span>
            <p><strong>学习记录</strong>可靠保存每一次真实投入</p>
          </div>
        </div>

        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="eyebrow">{mode === 'login' ? '欢迎回来' : '创建工作区'}</span>
            <h2>{mode === 'login' ? '登录轻学计划' : '建立学习账号'}</h2>
            <p>
              {mode === 'login'
                ? '继续处理今天最重要的任务。'
                : '几秒钟即可开始组织你的工作。'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="form-field">
              <span>用户名</span>
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="3–32 位字母、数字或 _ . -"
                maxLength={32}
                aria-invalid={Boolean(fieldErrors.username)}
              />
              {fieldErrors.username && <small className="field-error">{fieldErrors.username}</small>}
            </label>

            {mode === 'register' && (
              <label className="form-field">
                <span>显示名称</span>
                <input
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="看板上显示的名字"
                  maxLength={80}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                />
                {fieldErrors.displayName && (
                  <small className="field-error">{fieldErrors.displayName}</small>
                )}
              </label>
            )}

            <label className="form-field">
              <span>密码</span>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'register' ? '至少 8 位，包含字母和数字' : '输入登录密码'}
                maxLength={72}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
            </label>

            {error && (
              <div className="form-error auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={
                submitting ||
                !username.trim() ||
                !password ||
                (mode === 'register' && !displayName.trim())
              }
            >
              {submitting ? '请稍候…' : mode === 'login' ? '进入工作台' : '创建并登录'}
              {!submitting && <ArrowIcon />}
            </button>
          </form>

          <div className="auth-switch">
            <span>{mode === 'login' ? '还没有账号？' : '已经注册？'}</span>
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '立即注册' : '返回登录'}
            </button>
          </div>
        </div>

        <p className="auth-security">密码使用 BCrypt 加密，会话由 Redis 管理。</p>
      </section>
    </main>
  )
}

