// ── WaitingScreen ─────────────────────────────────────────────
// Pre-game waiting room shown when a scheduled time is set.
// Displays countdown, seat list, and pending invite status.

import { useState, useEffect } from 'react'
import { t } from '../i18n/translations'
import { formatBothTimezones } from '../utils/time'

const IS_MOBILE  = typeof window !== 'undefined' && window.innerWidth <= 480
const WINDS      = ['east', 'south', 'west', 'north']
const WIND_CHARS = { east: '東', south: '南', west: '西', north: '北' }

const S = {
  page: {
    height:     '100vh',
    overflowY:  'auto',
    background: '#1a1a2e',
    color:      '#f5f2e8',
    fontFamily: '-apple-system, sans-serif',
  },
  header: {
    background:   '#16213e',
    padding:      IS_MOBILE ? '18px 24px' : '14px 20px',
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    borderBottom: '1px solid #2a2a4e',
  },
  backBtn: {
    background: 'none',
    border:     'none',
    color:      '#888',
    fontSize:   IS_MOBILE ? 40 : 20,
    cursor:     'pointer',
    padding:    0,
  },
  headerTitle: {
    fontSize:   IS_MOBILE ? 28 : 15,
    fontWeight: 700,
    color:      '#f5f2e8',
    flex:       1,
  },
  roomCode: {
    background:    '#c0392b',
    color:         '#fff',
    padding:       IS_MOBILE ? '6px 16px' : '4px 12px',
    borderRadius:  6,
    fontSize:      IS_MOBILE ? 28 : 15,
    fontWeight:    700,
    letterSpacing: '0.15em',
  },
  body: {
    padding:  IS_MOBILE ? '18px 16px' : 16,
    maxWidth: 480,
    margin:   '0 auto',
  },
  card: {
    background:   '#16213e',
    borderRadius: 12,
    padding:      IS_MOBILE ? 20 : 16,
    marginBottom: 14,
    border:       '1px solid #2a2a4e',
  },
  cardTitle: {
    fontSize:      IS_MOBILE ? 20 : 11,
    fontWeight:    600,
    color:         '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom:  IS_MOBILE ? 14 : 10,
  },
  schedLine: {
    fontSize:   IS_MOBILE ? 20 : 13,
    color:      '#ccc',
    lineHeight: 1.8,
  },
  countdown: {
    marginTop:    IS_MOBILE ? 14 : 10,
    padding:      IS_MOBILE ? '12px 16px' : '8px 12px',
    background:   '#0d1b2a',
    border:       '1px solid #ffd700',
    borderRadius: 8,
    textAlign:    'center',
    fontSize:     IS_MOBILE ? 26 : 16,
    fontWeight:   700,
    color:        '#ffd700',
    letterSpacing: '0.05em',
  },
  allPresent: {
    marginTop:    IS_MOBILE ? 14 : 10,
    padding:      IS_MOBILE ? '12px 16px' : '8px 12px',
    background:   '#1a3a2a',
    border:       '1px solid #2ecc71',
    borderRadius: 8,
    textAlign:    'center',
    fontSize:     IS_MOBILE ? 20 : 13,
    fontWeight:   600,
    color:        '#2ecc71',
  },
  seatRow: {
    display:      'flex',
    alignItems:   'center',
    gap:          IS_MOBILE ? 14 : 10,
    padding:      IS_MOBILE ? '12px 0' : '8px 0',
    borderBottom: '1px solid #1a1a3e',
  },
  windBadge: {
    width:          IS_MOBILE ? 48 : 32,
    height:         IS_MOBILE ? 48 : 32,
    borderRadius:   6,
    background:     '#0d1b2a',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       IS_MOBILE ? 26 : 16,
    fontWeight:     700,
    color:          '#f5f2e8',
    flexShrink:     0,
  },
  seatName: {
    flex:     1,
    fontSize: IS_MOBILE ? 22 : 13,
    color:    '#ccc',
  },
  seatCheck: {
    fontSize: IS_MOBILE ? 22 : 14,
    color:    '#2ecc71',
    fontWeight: 700,
  },
  seatEmpty: {
    fontSize:  IS_MOBILE ? 18 : 12,
    color:     '#555',
    fontStyle: 'italic',
  },
  claimBtn: {
    background:   '#1a4a2a',
    color:        '#2ecc71',
    border:       '1px solid #2ecc71',
    borderRadius: 6,
    padding:      IS_MOBILE ? '8px 16px' : '4px 10px',
    fontSize:     IS_MOBILE ? 20 : 11,
    fontWeight:   600,
    cursor:       'pointer',
  },
  pendingItem: {
    fontSize:  IS_MOBILE ? 18 : 12,
    color:     '#888',
    padding:   IS_MOBILE ? '6px 0' : '3px 0',
    display:   'flex',
    alignItems:'center',
    gap:       8,
  },
  startBtn: {
    width:        '100%',
    padding:      IS_MOBILE ? '18px 20px' : '13px 16px',
    borderRadius: 8,
    border:       'none',
    fontSize:     IS_MOBILE ? 28 : 15,
    fontWeight:   600,
    cursor:       'pointer',
    background:   '#c0392b',
    color:        '#fff',
    marginBottom: 10,
  },
  editBtn: {
    width:        '100%',
    padding:      IS_MOBILE ? '14px 20px' : '10px 16px',
    borderRadius: 8,
    border:       '1px solid #2a2a4e',
    fontSize:     IS_MOBILE ? 24 : 13,
    fontWeight:   600,
    cursor:       'pointer',
    background:   'transparent',
    color:        '#888',
    marginBottom: 10,
  },
}

function formatMs(ms) {
  if (ms <= 0) return '0:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const FIVE_MIN = 5 * 60 * 1000

export default function WaitingScreen({
  room,
  myUid,
  myWind,
  isHost,
  lang,
  onBack,
  onEditSettings,
  onClaimSeat,
  onStartNow,     // fill empty seats with AI + startGame
}) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const schedDate    = room.scheduledTime?.toDate?.() ?? null
  const schedMs      = schedDate?.getTime() ?? null
  const deadlineMs   = schedMs ? schedMs + FIVE_MIN : null
  const { uk, hk }   = formatBothTimezones(schedDate)

  const msToStart    = schedMs    ? schedMs    - now : null
  const msToDeadline = deadlineMs ? deadlineMs - now : null

  const showCountdown  = msToStart !== null && msToStart < FIVE_MIN
  const gracePeriod    = msToStart !== null && msToStart <= 0 && msToDeadline > 0
  const timedOut       = deadlineMs !== null && now >= deadlineMs

  // Host auto-starts when deadline is reached
  useEffect(() => {
    if (isHost && timedOut && room.status === 'waiting') {
      onStartNow?.()
    }
  }, [timedOut, isHost, room.status])

  const invitedUids  = room.invitedUids  ?? []
  const invitedNames = room.invitedNames ?? {}
  const seatedUids   = Object.values(room.seats ?? {})
    .filter(s => s.type === 'human').map(s => s.uid)
  const pendingUids  = invitedUids.filter(uid => !seatedUids.includes(uid))
  const allPresent   = invitedUids.length > 0 && pendingUids.length === 0
  const canClaimSeat = !myWind && !isHost

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>←</button>
        <span style={S.headerTitle}>{t(lang, 'waitingForPlayers')}</span>
        <span style={S.roomCode}>{room.roomCode}</span>
      </div>

      <div style={S.body}>

        {/* Scheduled time + countdown */}
        <div style={S.card}>
          <div style={S.cardTitle}>{t(lang, 'scheduledTime')}</div>
          <div style={S.schedLine}>
            <div>🇬🇧 {uk}</div>
            <div>🇭🇰 {hk}</div>
          </div>

          {allPresent ? (
            <div style={S.allPresent}>{t(lang, 'allPlayersPresent')}</div>
          ) : showCountdown ? (
            <div style={S.countdown}>
              {gracePeriod
                ? `${t(lang, 'startingNow')} ${formatMs(msToDeadline)}`
                : `${t(lang, 'gameStartingIn')} ${formatMs(msToStart)}`
              }
            </div>
          ) : null}
        </div>

        {/* Seat list */}
        <div style={S.card}>
          <div style={S.cardTitle}>{t(lang, 'seats')}</div>
          {WINDS.map((wind, i) => {
            const seat   = room.seats?.[wind]
            const isMe   = seat?.uid === myUid
            const isHuman = seat?.type === 'human'
            const isLast  = i === WINDS.length - 1

            return (
              <div key={wind} style={{ ...S.seatRow, borderBottom: isLast ? 'none' : '1px solid #1a1a3e' }}>
                <div style={S.windBadge}>{WIND_CHARS[wind]}</div>
                <div style={S.seatName}>
                  {isHuman
                    ? (isMe ? `${seat.name} (${lang === 'zh' ? '你' : 'You'})` : seat.name)
                    : <span style={S.seatEmpty}>—</span>
                  }
                </div>
                {isHuman ? (
                  <span style={S.seatCheck}>✓</span>
                ) : canClaimSeat ? (
                  <button style={S.claimBtn} onClick={() => onClaimSeat?.(wind)}>
                    {t(lang, 'join')}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Pending invites */}
        {pendingUids.length > 0 && (
          <div style={S.card}>
            <div style={S.cardTitle}>{t(lang, 'pendingInvites')}</div>
            {pendingUids.map(uid => (
              <div key={uid} style={S.pendingItem}>
                <span>⏳</span>
                <span>{invitedNames[uid] || uid}</span>
              </div>
            ))}
          </div>
        )}

        {/* Host controls */}
        {isHost && (allPresent || invitedUids.length === 0) && (
          <button style={S.startBtn} onClick={onStartNow}>
            {t(lang, 'startGame')}
          </button>
        )}

        {isHost && (
          <button style={S.editBtn} onClick={onEditSettings}>
            ← {t(lang, 'editSettings')}
          </button>
        )}

      </div>
    </div>
  )
}
