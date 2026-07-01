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
import {
  createRoom, joinRoom, claimSeat,
  setSeatToAI, updateRoomSettings, deleteRoom, leaveRoom, deleteUserStaleRooms,
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
      setCurrentRoom(updated)
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

  async function handleCleanupRooms() {
    if (!user?.uid) return
    try {
      const count = await deleteUserStaleRooms(user.uid)
      return count
    } catch (err) {
      console.error('Cleanup rooms error:', err)
      return 0
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

  // ── Room page ──────────────────────────────────────────────
  if (page === 'room' && currentRoom) {
    // Active game → GamePage
    if (currentRoom.status === 'playing') {
      return (
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
    }

    const isHost        = currentRoom.hostUid === user.uid
    const hasSchedule   = !!currentRoom.scheduledTime
    const scheduledDate = currentRoom.scheduledTime?.toDate?.() ?? null

    // WaitingScreen: shown when a scheduled time is set and host isn't editing settings
    if (hasSchedule && !editingSettings) {
      return (
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
    }

    // Pre-game lobby → RoomPage
    return (
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

  // ── Leaderboard ────────────────────────────────────────────
  if (page === 'leaderboard') {
    return <LeaderboardPage lang={lang} onBack={() => setPage('lobby')} />
  }

  // ── Lobby ──────────────────────────────────────────────────
  return (
    <LobbyPage
      profile={profile}
      lang={lang}
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onSignOut={signOut}
      activeGames={activeGames}
      onCleanupRooms={handleCleanupRooms}
      onOpenLeaderboard={() => setPage('leaderboard')}
    />
  )
}
