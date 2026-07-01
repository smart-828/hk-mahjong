// ── useAuth hook ──────────────────────────────────────────────
// Manages Firebase auth state and user profile in Firestore

import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase/config'

export function useAuth() {
  const [user, setUser]       = useState(null)   // Firebase Auth user
  const [profile, setProfile] = useState(null)   // Firestore user profile
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        await loadProfile(firebaseUser.uid)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function loadProfile(uid) {
    const ref  = doc(db, 'users', uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      setProfile(snap.data())
    } else {
      setProfile(null) // triggers profile setup screen
    }
  }

  async function signInWithGoogle() {
    setError(null)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      // Profile may already exist from previous sign-in
      const ref  = doc(db, 'users', result.user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        // New Google user — pre-fill name, still need language selection
        await setDoc(ref, {
          uid:         result.user.uid,
          email:       result.user.email,
          displayName: result.user.displayName || '',
          lang:        null, // triggers profile setup
          createdAt:   serverTimestamp(),
          updatedAt:   serverTimestamp(),
        })
      }
      await loadProfile(result.user.uid)
    } catch (err) {
      setError(err.message)
    }
  }

  async function signInWithEmail(email, password) {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(err.message)
    }
  }

  async function createAccount(email, password, displayName) {
    setError(null)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      // Create profile stub — language selected on next screen
      const ref = doc(db, 'users', result.user.uid)
      await setDoc(ref, {
        uid:         result.user.uid,
        email,
        displayName,
        lang:        null,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      })
      await loadProfile(result.user.uid)
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveProfile(displayName, lang) {
    if (!user) return
    setError(null)
    try {
      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        await updateDoc(ref, { displayName, lang, updatedAt: serverTimestamp() })
      } else {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email,
          displayName,
          lang,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      setProfile(prev => ({ ...prev, displayName, lang }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return {
    user,
    profile,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    createAccount,
    saveProfile,
    signOut,
    lang: profile?.lang || 'en',
  }
}
