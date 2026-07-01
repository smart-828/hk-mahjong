// ── Room Page ─────────────────────────────────────────────────
// Lobby for a specific room: seat selection, settings, start game

import { useState, useEffect, useRef } from 'react'
import { t } from '../i18n/translations'
import { formatBothTimezones, toDatetimeLocal } from '../utils/time'

const WINDS      = ['east', 'south', 'west', 'north']
const WIND_CHARS = { east: '東', south: '南', west: '西', north: '北' }
const AI_LEVELS  = ['aiEasy', 'aiMedium', 'aiHard']

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 480

const S = {
  page: {
    height:     '100vh',
    overflowY:  'auto',
    background: '#1a1a2e',
    color:      '#f5f2e8',
    fontFamily: '-apple-system, sans-serif',
    position:   'relative',
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
    fontSize:   IS_MOBILE ? 32 : 16,
    fontWeight: 700,
    color:      '#f5f2e8',
  },
  roomCode: {
    marginLeft:    'auto',
    background:    '#c0392b',
    color:         '#fff',
    padding:       IS_MOBILE ? '6px 16px' : '4px 12px',
    borderRadius:  6,
    fontSize:      IS_MOBILE ? 32 : 16,
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
    fontSize:      IS_MOBILE ? 22 : 12,
    fontWeight:    600,
    color:         '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom:  IS_MOBILE ? 16 : 12,
  },
  seatRow: {
    display:      'flex',
    alignItems:   'center',
    gap:          IS_MOBILE ? 14 : 10,
    padding:      IS_MOBILE ? '14px 0' : '10px 0',
    borderBottom: '1px solid #1a1a3e',
  },
  windBadge: {
    width:          IS_MOBILE ? 56 : 36,
    height:         IS_MOBILE ? 56 : 36,
    borderRadius:   6,
    background:     '#0d1b2a',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       IS_MOBILE ? 30 : 18,
    fontWeight:     700,
    color:          '#f5f2e8',
    flexShrink:     0,
  },
  seatName: {
    flex:     1,
    fontSize: IS_MOBILE ? 26 : 14,
    color:    '#ccc',
  },
  seatControl: { marginLeft: 'auto' },
  select: {
    background:   '#0d1b2a',
    color:        '#ccc',
    border:       '1px solid #2a2a4e',
    borderRadius: 6,
    padding:      IS_MOBILE ? '10px 14px' : '5px 8px',
    fontSize:     IS_MOBILE ? 24 : 13,
    cursor:       'pointer',
    outline:      'none',
  },
  claimBtn: {
    background:   '#1a4a2a',
    color:        '#2ecc71',
    border:       '1px solid #2ecc71',
    borderRadius: 6,
    padding:      IS_MOBILE ? '10px 20px' : '5px 10px',
    fontSize:     IS_MOBILE ? 24 : 12,
    fontWeight:   600,
    cursor:       'pointer',
  },
  occupiedBadge: {
    background:   '#1a3a5a',
    color:        '#5aabff',
    borderRadius: 6,
    padding:      IS_MOBILE ? '8px 18px' : '4px 10px',
    fontSize:     IS_MOBILE ? 22 : 12,
    fontWeight:   600,
  },
  youBadge: {
    background:   '#3a1a1a',
    color:        '#e74c3c',
    borderRadius: 6,
    padding:      IS_MOBILE ? '8px 18px' : '4px 10px',
    fontSize:     IS_MOBILE ? 22 : 12,
    fontWeight:   600,
  },
  settingRow: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        IS_MOBILE ? '12px 0' : '8px 0',
    borderBottom:   '1px solid #1a1a3e',
    fontSize:       IS_MOBILE ? 24 : 13,
  },
  settingLabel: { color: '#aaa' },
  toggle: {
    width:        IS_MOBILE ? 64 : 40,
    height:       IS_MOBILE ? 36 : 22,
    borderRadius: IS_MOBILE ? 18 : 11,
    cursor:       'pointer',
    border:       'none',
    transition:   'background 0.2s',
    flexShrink:   0,
  },
  btn: {
    width:        '100%',
    padding:      IS_MOBILE ? '18px 20px' : '13px 16px',
    borderRadius: 8,
    border:       'none',
    fontSize:     IS_MOBILE ? 30 : 15,
    fontWeight:   600,
    cursor:       'pointer',
    marginBottom: 10,
  },
  btnPrimary:   { background: '#c0392b', color: '#fff' },
  btnSecondary: { background: '#0f3460', color: '#fff' },
  btnDisabled:  { background: '#2a2a4e', color: '#555', cursor: 'not-allowed' },
  copyRow: {
    display:    'flex',
    gap:        8,
    alignItems: 'center',
  },
  codeDisplay: {
    flex:          1,
    background:    '#0d1b2a',
    border:        '1px solid #2a2a4e',
    borderRadius:  8,
    padding:       IS_MOBILE ? '14px 20px' : '10px 14px',
    fontSize:      IS_MOBILE ? 36 : 20,
    fontWeight:    700,
    letterSpacing: '0.2em',
    color:         '#f5f2e8',
    textAlign:     'center',
  },
  copyBtn: {
    background:   '#0f3460',
    color:        '#fff',
    border:       'none',
    borderRadius: 8,
    padding:      IS_MOBILE ? '14px 22px' : '10px 16px',
    fontSize:     IS_MOBILE ? 24 : 13,
    fontWeight:   600,
    cursor:       'pointer',
  },
}

const DEFAULT_SETTINGS = {
  minFaan:        3,
  scoringTable:   'half',
  limitValue:     64,
  claimTimeout:   24,
  autoDiscard:    true,
  rounds:         1,
  allow13orphans: true,
  allowHeavenly:  true,
}

// Modal for selecting players to invite
function InviteModal({ currentUid, lang, selected, onToggle, allUsers, loading, onClose, onConfirm }) {
  const eligible = allUsers.filter(u => u.uid !== currentUid)

  function handleConfirm() {
    const uids  = [...selected]
    const names = Object.fromEntries(
      uids.map(uid => [uid, allUsers.find(u => u.uid === uid)?.displayName || uid])
    )
    onConfirm(uids, names)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        background:     '#16213e',
        border:         '1px solid #2a2a4e',
        borderRadius:   14,
        padding:        IS_MOBILE ? 24 : 20,
        width:          '90%',
        maxWidth:       420,
        maxHeight:      '80vh',
        display:        'flex',
        flexDirection:  'column',
      }}>
        <div style={{ fontWeight: 700, fontSize: IS_MOBILE ? 26 : 16, color: '#f5f2e8', marginBottom: IS_MOBILE ? 16 : 12 }}>
          {t(lang, 'selectPlayers')}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: IS_MOBILE ? 16 : 12 }}>
          {loading ? (
            <div style={{ color: '#888', textAlign: 'center', padding: 24, fontSize: IS_MOBILE ? 22 : 14 }}>…</div>
          ) : eligible.length === 0 ? (
            <div style={{ color: '#555', textAlign: 'center', padding: 24, fontSize: IS_MOBILE ? 20 : 13 }}>
              {lang === 'zh' ? '沒有其他玩家' : 'No other players found'}
            </div>
          ) : eligible.map(u => (
            <div
              key={u.uid}
              onClick={() => onToggle(u.uid)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: IS_MOBILE ? '13px 4px' : '9px 4px', borderBottom: '1px solid #1a1a3e', cursor: 'pointer' }}
            >
              <span style={{ fontSize: IS_MOBILE ? 24 : 15, color: selected.has(u.uid) ? '#2ecc71' : '#444', minWidth: 20 }}>
                {selected.has(u.uid) ? '✓' : '○'}
              </span>
              <span style={{ fontSize: IS_MOBILE ? 22 : 14, color: '#f5f2e8' }}>
                {u.displayName}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{ flex: 1, background: 'transparent', border: '1px solid #2a2a4e', color: '#888', borderRadius: 7, padding: IS_MOBILE ? '13px 16px' : '9px 14px', fontSize: IS_MOBILE ? 22 : 13, cursor: 'pointer' }}
            onClick={onClose}
          >
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            style={{ flex: 1, background: '#1a4a2a', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: 7, padding: IS_MOBILE ? '13px 16px' : '9px 14px', fontSize: IS_MOBILE ? 22 : 13, fontWeight: 600, cursor: 'pointer' }}
            onClick={handleConfirm}
          >
            {t(lang, 'done')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Gradient fade at the bottom of the scroll container — disappears when user reaches the end
function ScrollFade({ scrollRef }) {
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    function check() {
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 12)
    }
    el.addEventListener('scroll', check, { passive: true })
    check()
    return () => el.removeEventListener('scroll', check)
  }, [scrollRef])

  if (atBottom) return null
  return (
    <div style={{
      position:       'fixed',
      bottom:         0,
      left:           0,
      right:          0,
      height:         IS_MOBILE ? 72 : 52,
      background:     'linear-gradient(to bottom, transparent, rgba(26,26,46,0.97))',
      pointerEvents:  'none',
      zIndex:         20,
      display:        'flex',
      justifyContent: 'center',
      alignItems:     'flex-end',
      paddingBottom:  IS_MOBILE ? 14 : 10,
    }}>
      <span style={{ color: '#888', fontSize: IS_MOBILE ? 26 : 18 }}>▼</span>
    </div>
  )
}

export default function RoomPage({
  lang,
  roomCode,
  isHost,
  seats,          // { east: {uid, name, type:'human'|'ai', aiLevel, isMe}, ... }
  myUid,
  onClaimSeat,
  onSetSeatType,  // host only
  onStartGame,
  onDeleteRoom,
  onLeaveRoom,
  onBack,
  settings: initialSettings,
  onUpdateSettings,
  // Invite / schedule
  scheduledTime,        // Date | null
  invitedUids,          // string[]
  invitedNames,         // { [uid]: string }
  onSetScheduledTime,   // (date | null) => void
  onSetInvitedPlayers,  // (uids, names) => void
  onLoadUsers,          // () => Promise<user[]>
}) {
  const [settings, setSettings] = useState(initialSettings || DEFAULT_SETTINGS)
  const [copied, setCopied]     = useState(false)
  const scrollRef               = useRef(null)

  // Schedule state
  const [schedStr, setSchedStr]       = useState(scheduledTime ? toDatetimeLocal(scheduledTime) : '')
  const minStr                        = toDatetimeLocal(new Date())
  const schedDate                     = schedStr ? new Date(schedStr) : null
  const { uk, hk }                    = formatBothTimezones(schedDate)

  // Sync schedStr if scheduledTime prop changes (e.g. Firestore round-trip)
  useEffect(() => {
    setSchedStr(scheduledTime ? toDatetimeLocal(scheduledTime) : '')
  }, [scheduledTime])

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [allUsers, setAllUsers]               = useState([])
  const [loadingUsers, setLoadingUsers]       = useState(false)
  const [pendingInvites, setPendingInvites]   = useState(new Set())

  async function handleOpenInvite() {
    setPendingInvites(new Set(invitedUids ?? []))
    setShowInviteModal(true)
    setLoadingUsers(true)
    try {
      const users = await onLoadUsers?.() ?? []
      setAllUsers(users)
    } catch (err) {
      console.error('Load users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  function updateSetting(key, value) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    onUpdateSettings?.(next)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const humanCount = Object.values(seats).filter(s => s?.type === 'human').length
  const canStart   = isHost && humanCount >= 1

  return (
    <div ref={scrollRef} style={S.page}>
      <ScrollFade scrollRef={scrollRef} />

      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>←</button>
        <span style={S.headerTitle}>{t(lang, 'seats')}</span>
        <span style={S.roomCode}>{roomCode}</span>
      </div>

      <div style={S.body}>

        {/* Share code */}
        <div style={S.card}>
          <div style={S.cardTitle}>{t(lang, 'shareCode')}</div>
          <div style={S.copyRow}>
            <div style={S.codeDisplay}>{roomCode}</div>
            <button style={S.copyBtn} onClick={copyCode}>
              {copied ? t(lang, 'copied') : t(lang, 'copyCode')}
            </button>
          </div>
        </div>

        {/* Seats */}
        <div style={S.card}>
          <div style={S.cardTitle}>{t(lang, 'seats')}</div>
          {WINDS.map((wind, i) => {
            const seat    = seats[wind]
            const isMe    = seat?.uid === myUid
            const isEmpty = !seat || seat.type === 'ai'

            return (
              <div key={wind} style={{ ...S.seatRow, borderBottom: i === 3 ? 'none' : '1px solid #1a1a3e' }}>
                <div style={S.windBadge}>{WIND_CHARS[wind]}</div>
                <div style={S.seatName}>
                  {seat?.name || (isEmpty ? (isHost ? '' : t(lang, 'ai')) : '—')}
                </div>
                <div style={S.seatControl}>
                  {isMe ? (
                    <span style={S.youBadge}>YOU</span>
                  ) : seat?.type === 'human' ? (
                    <span style={S.occupiedBadge}>{seat.name}</span>
                  ) : isHost ? (
                    <select
                      style={S.select}
                      value={seat?.aiLevel || 'aiMedium'}
                      onChange={e => onSetSeatType?.(wind, 'ai', e.target.value)}
                    >
                      {AI_LEVELS.map(l => (
                        <option key={l} value={l}>{t(lang, l)}</option>
                      ))}
                    </select>
                  ) : (
                    <button style={S.claimBtn} onClick={() => onClaimSeat?.(wind)}>
                      {t(lang, 'join')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Room settings (host only) */}
        {isHost && (
          <div style={S.card}>
            <div style={S.cardTitle}>{t(lang, 'roomSettings')}</div>

            <div style={S.settingRow}>
              <span style={S.settingLabel}>{t(lang, 'minFaan')}</span>
              <select style={S.select} value={settings.minFaan} onChange={e => updateSetting('minFaan', +e.target.value)}>
                {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div style={S.settingRow}>
              <span style={S.settingLabel}>{t(lang, 'scoringTable')}</span>
              <select style={S.select} value={settings.scoringTable} onChange={e => updateSetting('scoringTable', e.target.value)}>
                <option value="half">{t(lang, 'halfSpicy')}</option>
                <option value="full">{t(lang, 'fullSpicy')}</option>
              </select>
            </div>

            <div style={S.settingRow}>
              <span style={S.settingLabel}>{t(lang, 'limitValue')}</span>
              <select style={S.select} value={settings.limitValue} onChange={e => updateSetting('limitValue', +e.target.value)}>
                {[32,64,128].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div style={S.settingRow}>
              <span style={S.settingLabel}>{t(lang, 'claimTimeout')}</span>
              <select style={S.select} value={settings.claimTimeout} onChange={e => updateSetting('claimTimeout', +e.target.value)}>
                <option value={12}>{t(lang, 'hours12')}</option>
                <option value={24}>{t(lang, 'hours24')}</option>
                <option value={48}>{t(lang, 'hours48')}</option>
                <option value={72}>{t(lang, 'hours72')}</option>
              </select>
            </div>

            <div style={S.settingRow}>
              <span style={S.settingLabel}>{t(lang, 'rounds')}</span>
              <select style={S.select} value={settings.rounds} onChange={e => updateSetting('rounds', +e.target.value)}>
                <option value={1}>{t(lang, 'round1')}</option>
                <option value={2}>{t(lang, 'round2')}</option>
                <option value={4}>{t(lang, 'round4')}</option>
              </select>
            </div>

            <div style={S.settingRow}>
              <span style={S.settingLabel}>{t(lang, 'allow13orphans')}</span>
              <button
                style={{ ...S.toggle, background: settings.allow13orphans ? '#1e8c4e' : '#2a2a4e' }}
                onClick={() => updateSetting('allow13orphans', !settings.allow13orphans)}
              />
            </div>

            <div style={{ ...S.settingRow, borderBottom: 'none' }}>
              <span style={S.settingLabel}>{t(lang, 'allowHeavenly')}</span>
              <button
                style={{ ...S.toggle, background: settings.allowHeavenly ? '#1e8c4e' : '#2a2a4e' }}
                onClick={() => updateSetting('allowHeavenly', !settings.allowHeavenly)}
              />
            </div>
          </div>
        )}

        {/* Scheduled time (host only) */}
        {isHost && (
          <div style={S.card}>
            <div style={S.cardTitle}>{t(lang, 'scheduledTime')}</div>
            <input
              type="datetime-local"
              value={schedStr}
              min={minStr}
              onChange={e => setSchedStr(e.target.value)}
              onBlur={e => onSetScheduledTime?.(e.target.value ? new Date(e.target.value) : null)}
              style={{ ...S.select, width: '100%', padding: IS_MOBILE ? '12px 14px' : '8px 10px', boxSizing: 'border-box' }}
            />
            {schedDate && (
              <div style={{ fontSize: IS_MOBILE ? 18 : 12, color: '#aaa', marginTop: 10, lineHeight: 1.9 }}>
                <div>🇬🇧 {uk}</div>
                <div>🇭🇰 {hk}</div>
              </div>
            )}
            {schedDate && (
              <button
                style={{ marginTop: 8, background: 'transparent', border: '1px solid #c0392b44', color: '#c0392b', borderRadius: 5, padding: IS_MOBILE ? '7px 14px' : '4px 10px', fontSize: IS_MOBILE ? 18 : 11, cursor: 'pointer' }}
                onClick={() => { setSchedStr(''); onSetScheduledTime?.(null) }}
              >
                {t(lang, 'clearSchedule')}
              </button>
            )}
          </div>
        )}

        {/* Invite players (host only) */}
        {isHost && (
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: IS_MOBILE ? 14 : 10 }}>
              <div style={{ ...S.cardTitle, marginBottom: 0, flex: 1 }}>{t(lang, 'invitePlayers')}</div>
              <button
                style={{ background: '#1a3a2a', border: '1px solid #2ecc71', color: '#2ecc71', borderRadius: 6, padding: IS_MOBILE ? '8px 14px' : '4px 10px', fontSize: IS_MOBILE ? 20 : 11, cursor: 'pointer', fontWeight: 600 }}
                onClick={handleOpenInvite}
              >
                + {t(lang, 'selectPlayers')}
              </button>
            </div>
            {(invitedUids ?? []).length === 0 ? (
              <div style={{ fontSize: IS_MOBILE ? 18 : 12, color: '#555' }}>
                {t(lang, 'noPlayersInvited')}
              </div>
            ) : (invitedUids ?? []).map(uid => (
              <div key={uid} style={{ fontSize: IS_MOBILE ? 20 : 12, color: '#2ecc71', padding: IS_MOBILE ? '5px 0' : '3px 0' }}>
                ✓ {(invitedNames ?? {})[uid] || uid}
              </div>
            ))}
          </div>
        )}

        {/* Start / waiting */}
        {isHost ? (
          <button
            style={{ ...S.btn, ...(canStart ? S.btnPrimary : S.btnDisabled) }}
            onClick={canStart ? onStartGame : undefined}
            disabled={!canStart}
          >
            {t(lang, 'startGame')}
          </button>
        ) : (
          <div style={{
            textAlign: 'center',
            color:     '#aaa',
            fontSize:  IS_MOBILE ? 26 : 14,
            padding:   12,
          }}>
            {t(lang, 'waitingForPlayers')}
          </div>
        )}

        {/* Danger actions */}
        {isHost ? (
          <button
            style={{
              ...S.btn,
              marginTop:  IS_MOBILE ? 10 : 6,
              background: 'transparent',
              color:      '#e74c3c',
              border:     `2px solid #e74c3c`,
              fontSize:   IS_MOBILE ? 26 : 14,
            }}
            onClick={() => {
              const msg = lang === 'zh' ? '確定刪除此房間？' : 'Delete this room?'
              if (window.confirm(msg)) onDeleteRoom?.()
            }}
          >
            {lang === 'zh' ? '🗑 刪除房間' : '🗑 Delete Room'}
          </button>
        ) : (
          <button
            style={{
              ...S.btn,
              marginTop:  IS_MOBILE ? 10 : 6,
              background: 'transparent',
              color:      '#e67e22',
              border:     `2px solid #e67e22`,
              fontSize:   IS_MOBILE ? 26 : 14,
            }}
            onClick={() => {
              const msg = lang === 'zh' ? '確定離開此房間？' : 'Leave this room?'
              if (window.confirm(msg)) onLeaveRoom?.()
            }}
          >
            {lang === 'zh' ? '← 離開房間' : '← Leave Room'}
          </button>
        )}

        {/* Bottom padding so content clears the scroll-fade gradient */}
        <div style={{ height: IS_MOBILE ? 80 : 60 }} />

      </div>

      {showInviteModal && (
        <InviteModal
          currentUid={myUid}
          lang={lang}
          selected={pendingInvites}
          onToggle={uid => setPendingInvites(s => {
            const n = new Set(s)
            if (n.has(uid)) n.delete(uid); else n.add(uid)
            return n
          })}
          allUsers={allUsers}
          loading={loadingUsers}
          onClose={() => setShowInviteModal(false)}
          onConfirm={(uids, names) => {
            onSetInvitedPlayers?.(uids, names)
            setShowInviteModal(false)
          }}
        />
      )}
    </div>
  )
}
