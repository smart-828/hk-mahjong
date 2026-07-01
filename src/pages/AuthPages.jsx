// ── Auth Pages ────────────────────────────────────────────────
// LoginPage: sign in / create account
// ProfileSetupPage: choose display name + language

import { useState } from 'react'
import { t } from '../i18n/translations'

const styles = {
  page: {
    minHeight: '100vh',
    background: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: '#16213e',
    borderRadius: 12,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f5f2e8',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  btn: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 10,
    transition: 'opacity 0.15s',
  },
  btnGoogle: {
    background: '#fff',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimary: {
    background: '#c0392b',
    color: '#fff',
  },
  btnSecondary: {
    background: '#0f3460',
    color: '#fff',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #2a2a4e',
    background: '#0d1b2a',
    color: '#f5f2e8',
    fontSize: 15,
    marginBottom: 10,
    outline: 'none',
    boxSizing: 'border-box',
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    display: 'block',
  },
  divider: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
    margin: '14px 0',
    position: 'relative',
  },
  error: {
    background: '#3d1010',
    color: '#ff6b6b',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
  },
  link: {
    color: '#1a6ab5',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  langOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 8,
    border: '2px solid #2a2a4e',
    cursor: 'pointer',
    marginBottom: 10,
    background: '#0d1b2a',
    transition: 'border-color 0.15s',
  },
}

// ── Login Page ────────────────────────────────────────────────
export function LoginPage({ onSignInGoogle, onSignInEmail, onCreateAccount, error }) {
  const [mode, setMode]           = useState('login') // 'login' | 'register'
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [codeError, setCodeError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'login') {
      onSignInEmail(email, password)
    } else {
      const expected = (import.meta.env.VITE_ACCESS_CODE ?? '').trim()
      if (expected && accessCode.trim().toLowerCase() !== expected.toLowerCase()) {
        setCodeError('Invalid access code / 通行碼不正確')
        return
      }
      setCodeError('')
      onCreateAccount(email, password, name)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🀄</div>
          <h1 style={styles.title}>香港麻雀</h1>
          <p style={styles.subtitle}>HK Mahjong · Async Multiplayer</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{ ...styles.btn, ...styles.btnGoogle }}
          onClick={onSignInGoogle}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div style={styles.divider}>or</div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label style={styles.label}>Display name</label>
              <input
                style={styles.input}
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </>
          )}
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {mode === 'register' && (
            <>
              <label style={styles.label}>Access Code / 通行碼</label>
              <input
                style={styles.input}
                placeholder="Enter access code / 輸入通行碼"
                value={accessCode}
                onChange={e => { setAccessCode(e.target.value); setCodeError('') }}
                required
              />
              {codeError && <div style={styles.error}>{codeError}</div>}
            </>
          )}
          <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div
          style={styles.link}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setCodeError('') }}
        >
          {mode === 'login' ? 'No account? Create one' : 'Already have an account? Sign in'}
        </div>
      </div>
    </div>
  )
}

// ── Profile Setup Page ────────────────────────────────────────
export function ProfileSetupPage({ initialName = '', onSave }) {
  const [name, setName] = useState(initialName)
  const [lang, setLang] = useState('en')

  function handleSave(e) {
    e.preventDefault()
    if (name.trim()) onSave(name.trim(), lang)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🀄</div>
          <h1 style={{ ...styles.title, fontSize: 22 }}>Set up your profile</h1>
          <p style={styles.subtitle}>設定你的檔案</p>
        </div>

        <form onSubmit={handleSave}>
          <label style={styles.label}>Display name / 顯示名稱</label>
          <input
            style={styles.input}
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
          />

          <label style={{ ...styles.label, marginTop: 16, marginBottom: 8 }}>
            Language / 語言
          </label>

          <div
            style={{
              ...styles.langOption,
              borderColor: lang === 'en' ? '#c0392b' : '#2a2a4e',
            }}
            onClick={() => setLang('en')}
          >
            <span style={{ fontSize: 24 }}>🇬🇧</span>
            <div>
              <div style={{ color: '#f5f2e8', fontWeight: 600 }}>English</div>
              <div style={{ color: '#888', fontSize: 12 }}>UI in English</div>
            </div>
            {lang === 'en' && (
              <span style={{ marginLeft: 'auto', color: '#c0392b', fontSize: 18 }}>✓</span>
            )}
          </div>

          <div
            style={{
              ...styles.langOption,
              borderColor: lang === 'zh' ? '#c0392b' : '#2a2a4e',
            }}
            onClick={() => setLang('zh')}
          >
            <span style={{ fontSize: 24 }}>🇭🇰</span>
            <div>
              <div style={{ color: '#f5f2e8', fontWeight: 600 }}>繁體中文</div>
              <div style={{ color: '#888', fontSize: 12 }}>Traditional Chinese</div>
            </div>
            {lang === 'zh' && (
              <span style={{ marginLeft: 'auto', color: '#c0392b', fontSize: 18 }}>✓</span>
            )}
          </div>

          <button
            type="submit"
            style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 8 }}
            disabled={!name.trim()}
          >
            Save / 儲存
          </button>
        </form>
      </div>
    </div>
  )
}
