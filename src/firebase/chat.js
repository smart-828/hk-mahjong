// ── Chat (Firestore subcollection) ────────────────────────────
// rooms/{roomId}/chat/{messageId}  →  { wind, name, text, createdAt }

import {
  collection, addDoc, onSnapshot,
  serverTimestamp, query, orderBy, limitToLast,
} from 'firebase/firestore'
import { db } from './config'

export function sendMessage(roomId, wind, name, text) {
  return addDoc(collection(db, 'rooms', roomId, 'chat'), {
    wind,
    name,
    text: text.trim(),
    createdAt: serverTimestamp(),
  })
}

export function subscribeToChat(roomId, callback) {
  const q = query(
    collection(db, 'rooms', roomId, 'chat'),
    orderBy('createdAt'),
    limitToLast(60),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}
