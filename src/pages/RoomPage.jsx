// ── Room Page ─────────────────────────────────────────────────
// Lobby for a specific room: seat selection, settings, start game

import { useState } from 'react'
import { t } from '../i18n/translations'

const WINDS  = ['east', 'south', 'west', 'north']
const WIND_CHARS = { east: '東', south: '南', west: '西', north: '北' }
const AI_LEVELS = ['aiEasy', 'aiMedium', 'aiHard']

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
    gap: 12,
    borderBottom: '1px solid #2a2a4e',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 20,
    cursor: 'pointer',
    padding: 0,
  },
  headerTitle: { fontSize: 16, fontWeight: 700, color: '#f5f2e8' },
  roomCode: {
    marginLeft: 'auto',
    background: '#c0392b',
    color: '#fff',
    padding: '4px 12px',
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.15em',
  },
  body: { padding: 16, maxWidth: 480, margin: '0 auto' },
  card: {
    background: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    border: '1px solid #2a2a4e',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 12,
  },
  seatRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid #1a1a3e',
  },
  windBadge: {
    width: 36,
    height: 36,
    borderRadius: 6,
    background: '#0d1b2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: '#f5f2e8',
    flexShrink: 0,
  },
  seatName: { flex: 1, fontSize: 14, color: '#ccc' },
  seatControl: { marginLeft: 'auto' },
  select: {
    background: '#0d1b2a',
    color: '#ccc',
    border: '1px solid #2a2a4e',
    borderRadius: 6,
    padding: '5px 8px',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
  },
  claimBtn: {
    background: '#1a4a2a',
    color: '#2ecc71',
    border: '1px solid #2ecc71',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  occupiedBadge: {
    background: '#1a3a5a',
    color: '#5aabff',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  youBadge: {
    background: '#3a1a1a',
    color: '#e74c3c',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #1a1a3e',
    fontSize: 13,
  },
  settingLabel: { color: '#aaa' },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.2s',
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
  btnPrimary:   { background: '#c0392b', color: '#fff' },
  btnSecondary: { background: '#0f3460', color: '#fff' },
  btnDisabled:  { background: '#2a2a4e', color: '#555', cursor: 'not-allowed' },
  copyRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  codeDisplay: {
    flex: 1,
    background: '#0d1b2a',
    border: '1px solid #2a2a4e',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: '#f5f2e8',
    textAlign: 'center',
  },
  copyBtn: {
    background: '#0f3460',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
}

const DEFAULT_SETTINGS = {
  minFaan:       3,
  scoringTable:  'half',
  limitValue:    64,
  claimTimeout:  24,
  autoDiscard:   true,
  rounds:        1,
  allow13orphans: true,
  allowHeavenly:  true,
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
  onBack,
  settings: initialSettings,
  onUpdateSettings,
}) {
  const [settings, setSettings] = useState(initialSettings || DEFAULT_SETTINGS)
  const [copied, setCopied]     = useState(false)

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
    <div style={S.page}>
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
            const seat = seats[wind]
            const isMe = seat?.uid === myUid
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
          <div style={{ textAlign: 'center', color: '#555', fontSize: 14, padding: 12 }}>
            {t(lang, 'waitingForPlayers')}
          </div>
        )}

      </div>
    </div>
  )
}
