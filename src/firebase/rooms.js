// ── Room management ───────────────────────────────────────────
// Create, join, and manage game rooms in Firestore

import {
  collection, doc, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, query, where,
  serverTimestamp, onSnapshot,
} from 'firebase/firestore'
import { db } from './config'

// Generate a random 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I or O to avoid confusion
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// Ensure room code is unique
async function getUniqueRoomCode() {
  let code, exists = true
  while (exists) {
    code = generateRoomCode()
    const snap = await getDocs(
      query(collection(db, 'rooms'), where('roomCode', '==', code), where('status', '!=', 'finished'))
    )
    exists = !snap.empty
  }
  return code
}

// Create a new room
export async function createRoom(hostUser, hostProfile) {
  const roomCode = await getUniqueRoomCode()
  const roomRef  = doc(collection(db, 'rooms'))

  const roomData = {
    roomCode,
    hostUid: hostUser.uid,
    status:  'waiting',
    settings: {
      minFaan:        3,
      scoringTable:   'half',
      limitValue:     64,
      claimTimeoutHours: 24,
      autoDiscard:    true,
      rounds:         1,
      allow13orphans: true,
      allowHeavenly:  true,
    },
    seats: {
      east:  { uid: hostUser.uid, name: hostProfile.displayName, lang: hostProfile.lang, type: 'human' },
      south: { uid: 'AI', name: 'AI', lang: 'en', type: 'ai', aiLevel: 'aiMedium' },
      west:  { uid: 'AI', name: 'AI', lang: 'en', type: 'ai', aiLevel: 'aiMedium' },
      north: { uid: 'AI', name: 'AI', lang: 'en', type: 'ai', aiLevel: 'aiMedium' },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(roomRef, roomData)
  return { id: roomRef.id, ...roomData }
}

// Join an existing room by code
export async function joinRoom(roomCode, user, profile) {
  const snap = await getDocs(
    query(collection(db, 'rooms'), where('roomCode', '==', roomCode.toUpperCase()), where('status', '==', 'waiting'))
  )

  if (snap.empty) throw new Error('Room not found')

  const roomDoc  = snap.docs[0]
  const roomData = roomDoc.data()

  // Check if user already in room
  const inRoom = Object.values(roomData.seats).some(s => s.uid === user.uid)
  if (inRoom) return { id: roomDoc.id, ...roomData }

  // Find an AI seat to replace
  const aiSeat = Object.entries(roomData.seats).find(([, s]) => s.type === 'ai')
  if (!aiSeat) throw new Error('Room is full')

  const [wind] = aiSeat
  await updateDoc(doc(db, 'rooms', roomDoc.id), {
    [`seats.${wind}`]: {
      uid:  user.uid,
      name: profile.displayName,
      lang: profile.lang,
      type: 'human',
    },
    updatedAt: serverTimestamp(),
  })

  const updated = await getDoc(doc(db, 'rooms', roomDoc.id))
  return { id: updated.id, ...updated.data() }
}

// Claim a specific seat
export async function claimSeat(roomId, wind, user, profile) {
  const roomRef  = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('Room not found')

  const roomData = roomSnap.data()
  if (roomData.seats[wind]?.type === 'human') throw new Error('Seat already taken')

  await updateDoc(roomRef, {
    [`seats.${wind}`]: {
      uid:  user.uid,
      name: profile.displayName,
      lang: profile.lang,
      type: 'human',
    },
    updatedAt: serverTimestamp(),
  })
}

// Host updates seat to AI
export async function setSeatToAI(roomId, wind, aiLevel) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`seats.${wind}`]: { uid: 'AI', name: 'AI', lang: 'en', type: 'ai', aiLevel },
    updatedAt: serverTimestamp(),
  })
}

// Update room settings (host only)
export async function updateRoomSettings(roomId, settings) {
  await updateDoc(doc(db, 'rooms', roomId), {
    settings,
    updatedAt: serverTimestamp(),
  })
}

// Get active rooms for a user
export async function getUserRooms(uid) {
  const snap = await getDocs(
    query(collection(db, 'rooms'), where('status', 'in', ['waiting', 'playing']))
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => Object.values(r.seats).some(s => s.uid === uid))
}

// Delete a room (host only, waiting rooms)
export async function deleteRoom(roomId) {
  await deleteDoc(doc(db, 'rooms', roomId))
}

// Subscribe to a room (real-time)
export function subscribeToRoom(roomId, callback) {
  return onSnapshot(doc(db, 'rooms', roomId), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// Subscribe to user's active rooms
export function subscribeToUserRooms(uid, callback) {
  return onSnapshot(
    query(collection(db, 'rooms'), where('status', 'in', ['waiting', 'playing'])),
    snap => {
      const rooms = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => Object.values(r.seats).some(s => s.uid === uid))
      callback(rooms)
    }
  )
}
