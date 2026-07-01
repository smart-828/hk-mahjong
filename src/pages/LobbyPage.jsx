// ── Lobby Page ────────────────────────────────────────────────
// Home screen after login: create room, join room, active games

import { useState } from 'react'
import { t } from '../i18n/translations'

const S = {
  page: {
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#f5f2e8',
    fontFamily: '-apple-system, sans-serif',
  },
  header: {
    background: '#16213e',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #2a2a4e',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f5f2e8',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  body: {
    padding: 20,
    maxWidth: 480,
    margin: '0 auto',
  },
  card: {
    background: '#16213e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    border: '1px solid #2a2a4e',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 14,
  },
  btn: {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 8,
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 10,
  },
  btnPrimary: { background: '#c0392b', color: '#fff' },
  btnSecondary: { background: '#0f3460', color: '#fff' },
  btnGhost: { background: '#2a2a4e', color: '#ccc' },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 8,
    border: '1px solid #2a2a4e',
    background: '#0d1b2a',
    color: '#f5f2e8',
    fontSize: 15,
    marginBottom: 10,
    boxSizing: 'border-box',
    outline: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 700,
  },
  gameCard: {
    background: '#0d1b2a',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    border: '1px solid #2a2a4e',
  },
  gameCardTitle: { fontSize: 14, fontWeight: 600, color: '#f5f2e8' },
  gameCardMeta:  { fontSize: 12, color: '#888', marginTop: 2 },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 4,
  },
  badgeYourTurn: { background: '#c0392b22', color: '#e74c3c' },
  badgeWaiting:  { background: '#1a4a2a22', color: '#2ecc71' },
  profileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#c0392b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid #2a2a4e',
    color: '#888',
    padding: '5px 10px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
}

export default function LobbyPage({ profile, lang, onCreateRoom, onJoinRoom, onSignOut, activeGames = [], onCleanupRooms, onOpenLeaderboard }) {
  const [joinCode, setJoinCode]       = useState('')
  const [joining, setJoining]         = useState(false)
  const [error, setError]             = useState(null)
  const [cleanupMsg, setCleanupMsg]   = useState(null)

  async function handleJoin(e) {
    e.preventDefault()
    if (joinCode.length !== 4) return
    setJoining(true)
    setError(null)
    try {
      await onJoinRoom(joinCode.toUpperCase())
    } catch (err) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const initial = (profile?.displayName || '?')[0].toUpperCase()

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerTitle}>
          <span>🀄</span>
          <span>{t(lang, 'appName')}</span>
        </div>
        <div style={S.profileRow}>
          <button
            style={{ ...S.signOutBtn, color: '#d4a017', borderColor: '#d4a01744' }}
            onClick={onOpenLeaderboard}
          >
            {t(lang, 'leaderboard')}
          </button>
          <div style={S.avatar}>{initial}</div>
          <span style={{ fontSize: 13, color: '#ccc' }}>{profile?.displayName}</span>
          <button style={S.signOutBtn} onClick={onSignOut}>{t(lang, 'signOut')}</button>
        </div>
      </div>

      <div style={S.body}>

        {/* Create room */}
        <div style={S.card}>
          <div style={S.cardTitle}>{t(lang, 'createRoom')}</div>
          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            onClick={onCreateRoom}
          >
            + {t(lang, 'createRoom')}
          </button>
        </div>

        {/* Join room */}
        <div style={S.card}>
          <div style={S.cardTitle}>{t(lang, 'joinRoom')}</div>
          {error && (
            <div style={{ background: '#3d1010', color: '#ff6b6b', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleJoin}>
            <input
              style={S.input}
              placeholder="ABCD"
              maxLength={4}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              type="submit"
              style={{ ...S.btn, ...S.btnSecondary }}
              disabled={joinCode.length !== 4 || joining}
            >
              {joining ? '…' : t(lang, 'join')}
            </button>
          </form>
        </div>

        {/* Active games */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ ...S.cardTitle, marginBottom: 0, flex: 1 }}>{t(lang, 'myGames')}</div>
            {activeGames.length > 0 && (
              <button
                style={{
                  background:   'transparent',
                  border:       '1px solid #c0392b44',
                  color:        '#c0392b',
                  borderRadius: 6,
                  padding:      '3px 9px',
                  fontSize:     11,
                  cursor:       'pointer',
                  fontWeight:   600,
                }}
                onClick={async () => {
                  const msg = lang === 'zh'
                    ? '確定刪除所有已完成及等待中的房間？'
                    : 'Delete all your finished and waiting rooms?'
                  if (!window.confirm(msg)) return
                  const count = await onCleanupRooms?.()
                  setCleanupMsg(
                    lang === 'zh'
                      ? `已刪除 ${count ?? 0} 個房間`
                      : `Deleted ${count ?? 0} room${count === 1 ? '' : 's'}`
                  )
                  setTimeout(() => setCleanupMsg(null), 3000)
                }}
              >
                🗑 {lang === 'zh' ? '清除舊房間' : 'Clean up'}
              </button>
            )}
          </div>
          {cleanupMsg && (
            <div style={{ color: '#2ecc71', fontSize: 12, marginBottom: 10 }}>{cleanupMsg}</div>
          )}
          {activeGames.length === 0 ? (
            <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>
              {t(lang, 'noActiveGames')}
            </div>
          ) : (
            activeGames.map(game => (
              <div
                key={game.id}
                style={S.gameCard}
                onClick={() => game.onOpen()}
              >
                <div>
                  <div style={S.gameCardTitle}>
                    Room {game.roomCode}
                  </div>
                  <div style={S.gameCardMeta}>
                    {game.players} players · {game.tilesLeft} tiles left
                  </div>
                </div>
                <span style={{
                  ...S.badge,
                  ...(game.yourTurn ? S.badgeYourTurn : S.badgeWaiting),
                }}>
                  {game.yourTurn ? t(lang, 'yourTurn') : t(lang, 'waitingFor') + '…'}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
