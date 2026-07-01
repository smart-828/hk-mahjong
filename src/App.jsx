// ── App.jsx ───────────────────────────────────────────────────
// Root component: handles auth state and page routing

import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useGame } from './hooks/useGame'
import { LoginPage, ProfileSetupPage } from './pages/AuthPages'
import LobbyPage from './pages/LobbyPage'
import LeaderboardPage from './pages/LeaderboardPage'
import RoomPage from './pages/RoomPage'
import WaitingScreen from './pages/WaitingScreen'
import GamePage from './pages/GamePage'
import RulesPanel from './components/RulesPanel'

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 480

import {
  createRoom, joinRoom, claimSeat,
  setSeatToAI, updateRoomSettings, deleteRoom, leaveRoom,
  subscribeToRoom, subscribeToUserRooms,
  saveRoomConfig, fillEmptySeatsWithAI, getAllUsers,
} from './firebase/rooms'
import { startGame, startGameWhenReady } from './firebase/game'

export default function App() {
  const {
    user, profile, loading, error,
    signInWithGoogle, signInWithEmail,
    createAccount, saveProfile, signOut,
    lang,
  } = useAuth()

  const [page, setPage]                   = useState('lobby')   // 'lobby' | 'room'
  const [currentRoom, setCurrentRoom]     = useState(null)
  const [activeGames, setActiveGames]     = useState([])
  const [roomVisKey, setRoomVisKey]       = useState(0)  // increments on page-visible to force room re-subscribe
  const [editingSettings, setEditingSettings] = useState(false)  // host viewing RoomPage from WaitingScreen
  const [rulesOpen, setRulesOpen]         = useState(false)

  // Derive which wind seat the current user occupies in the current room
  const myWind = currentRoom
    ? Object.entries(currentRoom.seats ?? {}).find(([, s]) => s.uid === user?.uid)?.[0] ?? null
    : null

  const game = useGame(
    currentRoom?.status === 'playing' ? currentRoom.id : null,
    myWind,
    currentRoom,
  )

  // Subscribe to user's active games when logged in
  useEffect(() => {
    if (!user) return
    const unsub = subscribeToUserRooms(user.uid, rooms => {
      setActiveGames(rooms.map(r => {
        const myW       = Object.entries(r.seats ?? {}).find(([, s]) => s.uid === user.uid)?.[0]
        const yourTurn  = r.status === 'playing' && r.hand?.currentTurn === myW
        const isHost    = r.hostUid === user.uid
        const isInvited = !myW && (r.invitedUids ?? []).includes(user.uid)
        return {
          id:            r.id,
          roomCode:      r.roomCode,
          players:       Object.values(r.seats ?? {}).filter(s => s.type === 'human').length,
          tilesLeft:     r.hand?.tilesLeft ?? '—',
          status:        r.status,
          yourTurn,
          isHost,
          isInvited,
          scheduledTime: r.scheduledTime?.toDate?.() ?? null,
          onOpen:        () => openRoom(r),
          onDelete:      isHost   ? () => deleteRoom(r.id).catch(console.error) : null,
          onLeave:       !isHost && myW ? () => leaveRoom(r.id, myW).catch(console.error) : null,
        }
      }))
    })
    return unsub
  }, [user])

  // Re-subscribe when the tab/screen becomes visible again (fixes game lockup after phone screen lock)
  useEffect(() => {
    function onVisChange() {
      if (document.visibilityState === 'visible') setRoomVisKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [])

  // Subscribe to current room when in room page
  useEffect(() => {
    if (!currentRoom?.id) return
    const unsub = subscribeToRoom(currentRoom.id, updated => {
      if (updated === null) {
        // Room was deleted (e.g. game ended and all players navigated away)
        setCurrentRoom(null)
        setPage('lobby')
        setEditingSettings(false)
      } else {
        setCurrentRoom(updated)
      }
    })
    return unsub
  }, [currentRoom?.id, roomVisKey])

  function openRoom(room) {
    setCurrentRoom(room)
    setPage('room')
    setEditingSettings(false)
  }

  async function handleCreateRoom() {
    try {
      const room = await createRoom(user, profile)
      setCurrentRoom(room)
      setPage('room')
    } catch (err) {
      console.error('Create room error:', err)
    }
  }

  async function handleJoinRoom(code) {
    const room = await joinRoom(code, user, profile)
    setCurrentRoom(room)
    setPage('room')
  }

  async function handleClaimSeat(wind) {
    await claimSeat(currentRoom.id, wind, user, profile)
    startGameWhenReady(currentRoom.id).catch(console.error)
  }

  async function handleSetSeatType(wind, type, aiLevel) {
    await setSeatToAI(currentRoom.id, wind, aiLevel)
  }

  // Batch-save all room config then return to lobby (for scheduled games)
  async function handleSaveConfig({ settings, scheduledTime, invitedUids, invitedNames }) {
    if (!currentRoom?.id) return
    try {
      await saveRoomConfig(currentRoom.id, { settings, scheduledTime, invitedUids, invitedNames })
      setCurrentRoom(null)
      setPage('lobby')
      setEditingSettings(false)
    } catch (err) {
      console.error('Save config error:', err)
    }
  }

  // Save settings then start immediately (no schedule)
  async function handleStartNow({ settings }) {
    if (!currentRoom?.id) return
    try {
      await updateRoomSettings(currentRoom.id, settings)
      await startGame(currentRoom.id)
    } catch (err) {
      console.error('Start now error:', err)
    }
  }

  // WaitingScreen auto-start: fill empty seats with AI then start
  async function handleAutoStart() {
    if (!currentRoom?.id || currentRoom.status !== 'waiting') return
    try {
      await fillEmptySeatsWithAI(currentRoom.id)
      await startGame(currentRoom.id)
    } catch (err) {
      console.error('Auto-start error:', err)
    }
  }

  async function handleDeleteRoom() {
    if (!currentRoom?.id) return
    try {
      await deleteRoom(currentRoom.id)
      setCurrentRoom(null)
      setPage('lobby')
      setEditingSettings(false)
    } catch (err) {
      console.error('Delete room error:', err)
    }
  }

  async function handleLeaveRoom() {
    if (!currentRoom?.id || !myWind) return
    try {
      await leaveRoom(currentRoom.id, myWind)
      setCurrentRoom(null)
      setPage('lobby')
      setEditingSettings(false)
    } catch (err) {
      console.error('Leave room error:', err)
    }
  }

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 40 }}>🀄</div>
      </div>
    )
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!user) {
    return (
      <LoginPage
        onSignInGoogle={signInWithGoogle}
        onSignInEmail={signInWithEmail}
        onCreateAccount={createAccount}
        error={error}
      />
    )
  }

  // ── Logged in but no profile (language not set) ────────────
  if (!profile?.lang) {
    return (
      <ProfileSetupPage
        initialName={user.displayName || profile?.displayName || ''}
        onSave={saveProfile}
      />
    )
  }

  // ── In-app pages (consolidated so ? button renders once) ──
  const isHost        = page === 'room' && currentRoom ? currentRoom.hostUid === user.uid : false
  const hasSchedule   = page === 'room' && currentRoom ? !!currentRoom.scheduledTime : false
  const scheduledDate = page === 'room' && currentRoom ? currentRoom.scheduledTime?.toDate?.() ?? null : null

  let pageContent
  if (page === 'room' && currentRoom) {
    if (currentRoom.status === 'playing') {
      pageContent = (
        <GamePage
          room={currentRoom}
          myWind={myWind}
          game={game}
          lang={lang}
          onBack={() => {
            const roomId = currentRoom?.id
            const phase  = currentRoom?.hand?.phase
            setCurrentRoom(null)
            setPage('lobby')
            if (roomId && (phase === 'finished' || phase === 'exhausted')) {
              deleteRoom(roomId).catch(console.error)
            }
          }}
        />
      )
    } else if (hasSchedule && !editingSettings) {
      pageContent = (
        <WaitingScreen
          room={currentRoom}
          myUid={user.uid}
          myWind={myWind}
          isHost={isHost}
          lang={lang}
          onBack={() => { setCurrentRoom(null); setPage('lobby'); setEditingSettings(false) }}
          onEditSettings={() => setEditingSettings(true)}
          onClaimSeat={handleClaimSeat}
          onStartNow={handleAutoStart}
        />
      )
    } else {
      pageContent = (
        <RoomPage
          lang={lang}
          roomCode={currentRoom.roomCode}
          isHost={isHost}
          seats={currentRoom.seats}
          myUid={user.uid}
          settings={currentRoom.settings}
          onClaimSeat={handleClaimSeat}
          onSetSeatType={handleSetSeatType}
          onDeleteRoom={handleDeleteRoom}
          onLeaveRoom={handleLeaveRoom}
          onBack={() => {
            if (hasSchedule && editingSettings) {
              setEditingSettings(false)
            } else {
              setCurrentRoom(null); setPage('lobby')
            }
          }}
          scheduledTime={scheduledDate}
          invitedUids={currentRoom.invitedUids ?? []}
          invitedNames={currentRoom.invitedNames ?? {}}
          onLoadUsers={getAllUsers}
          onSaveConfig={handleSaveConfig}
          onStartNow={handleStartNow}
        />
      )
    }
  } else if (page === 'leaderboard') {
    pageContent = <LeaderboardPage lang={lang} onBack={() => setPage('lobby')} />
  } else {
    pageContent = (
      <LobbyPage
        profile={profile}
        lang={lang}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onSignOut={signOut}
        activeGames={activeGames}
        onOpenLeaderboard={() => setPage('leaderboard')}
      />
    )
  }

  return (
    <>
      {pageContent}

      {/* ── Floating rules button ── */}
      <button
        onClick={() => setRulesOpen(true)}
        style={{
          position:       'fixed',
          bottom:         IS_MOBILE ? 24 : 20,
          left:           IS_MOBILE ? 16 : 14,
          width:          IS_MOBILE ? 52 : 40,
          height:         IS_MOBILE ? 52 : 40,
          borderRadius:   '50%',
          background:     '#16213e',
          border:         '2px solid #4a4a7e',
          color:          '#e8c870',
          fontSize:       IS_MOBILE ? 22 : 16,
          fontWeight:     700,
          cursor:         'pointer',
          zIndex:         1400,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          boxShadow:      '0 2px 14px rgba(0,0,0,0.55)',
          fontFamily:     '-apple-system, sans-serif',
          userSelect:     'none',
        }}
      >
        ?
      </button>

      {/* ── Rules panel ── */}
      {rulesOpen && (
        <RulesPanel lang={lang} onClose={() => setRulesOpen(false)} />
      )}
    </>
  )
}
