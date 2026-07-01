// ── LeaderboardPage.jsx ───────────────────────────────────────
// Ranked list of all players by cumulative totalScore

import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { t } from '../i18n/translations'

const C = {
  bg:     '#1a1a2e',
  card:   '#16213e',
  darker: '#0d1b2a',
  border: '#2a2a4e',
  gold:   '#d4a017',
  red:    '#c0392b',
  text:   '#f5f2e8',
  muted:  '#888',
  green:  '#2ecc71',
}

const S = {
  page: {
    minHeight:  '100vh',
    background: C.bg,
    color:      C.text,
    fontFamily: '-apple-system, sans-serif',
  },
  header: {
    background:   C.card,
    padding:      '14px 52px 14px 20px',
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    borderBottom: `1px solid ${C.border}`,
  },
  backBtn: {
    background: 'none',
    border:     'none',
    color:      C.muted,
    fontSize:   20,
    padding:    0,
    cursor:     'pointer',
  },
  title: {
    fontSize:   18,
    fontWeight: 700,
    color:      C.text,
  },
  body: {
    padding:   '20px',
    maxWidth:  480,
    margin:    '0 auto',
  },
  table: {
    width:        '100%',
    borderCollapse: 'collapse',
  },
  th: {
    fontSize:      11,
    fontWeight:    600,
    color:         C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding:       '0 10px 10px',
    textAlign:     'left',
    borderBottom:  `1px solid ${C.border}`,
  },
  thRight: {
    textAlign: 'right',
  },
}

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage({ lang, onBack }) {
  const [players, setPlayers] = useState(null)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('totalScore', 'desc'))
    getDocs(q)
      .then(snap => setPlayers(snap.docs.map(d => d.data()).filter(p => p.gamesPlayed > 0)))
      .catch(err => { console.error(err); setError(err.message) })
  }, [])

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>←</button>
        <span style={S.title}>排行榜 {t(lang, 'leaderboard')}</span>
      </div>

      <div style={S.body}>
        {error && (
          <div style={{
            background: '#3d1010', color: '#ff6b6b',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {players === null && !error && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>
            …
          </div>
        )}

        {players?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>
            {t(lang, 'noScoresYet')}
          </div>
        )}

        {players?.length > 0 && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 36 }}>#</th>
                <th style={S.th}>{t(lang, 'displayName')}</th>
                <th style={{ ...S.th, ...S.thRight }}>{t(lang, 'totalScore')}</th>
                <th style={{ ...S.th, ...S.thRight }}>{t(lang, 'gamesPlayed')}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const isTop3  = i < 3
                const score   = p.totalScore ?? 0
                const positive = score >= 0
                return (
                  <tr key={p.uid ?? i} style={{
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <td style={{
                      padding:    '13px 10px',
                      fontSize:   isTop3 ? 18 : 13,
                      color:      C.muted,
                      fontWeight: isTop3 ? 700 : 400,
                      width:      36,
                    }}>
                      {isTop3 ? MEDAL[i] : i + 1}
                    </td>
                    <td style={{ padding: '13px 10px', fontSize: 14, fontWeight: isTop3 ? 700 : 400 }}>
                      {p.displayName ?? p.email ?? '—'}
                    </td>
                    <td style={{
                      padding:    '13px 10px',
                      textAlign:  'right',
                      fontSize:   14,
                      fontWeight: 700,
                      color:      positive ? C.green : C.red,
                    }}>
                      {positive ? `+${score}` : score}
                    </td>
                    <td style={{ padding: '13px 10px', textAlign: 'right', fontSize: 13, color: C.muted }}>
                      {p.gamesPlayed ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
