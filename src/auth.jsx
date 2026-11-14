import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

/*
  Customer accounts with Supabase (PostgreSQL). Needs VITE_SUPABASE_URL and
  VITE_SUPABASE_ANON_KEY (the public "anon" key — safe in the browser; the database's Row Level
  Security rules in supabase/schema.sql keep every customer's data private).
  If they are not set, the site works exactly as before, just without sign-in.
*/
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null

const AuthContext = createContext({ user: null, ready: true, enabled: false })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // just came back from Google or the email link: reopen the page they started on
      if (event === 'SIGNED_IN') setTimeout(reopenPage, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, ready, enabled: !!supabase }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/*
  Where to come back to after a sign-in link or Google. Supabase hands the session back in the
  URL's #fragment, which our page routes (#design-tshirt…) also use, so the return address has no
  fragment: the page they were on is remembered here and reopened once they are signed in.
*/
const RETURN_KEY = 'up-return-page'
const returnTo = () => {
  try { sessionStorage.setItem(RETURN_KEY, window.location.hash) } catch { /* private mode */ }
  try { localStorage.setItem(RETURN_KEY, window.location.hash) } catch { /* email link may open in a new tab */ }
  return window.location.origin + window.location.pathname
}
function reopenPage() {
  let hash = ''
  try {
    hash = sessionStorage.getItem(RETURN_KEY) || localStorage.getItem(RETURN_KEY) || ''
    sessionStorage.removeItem(RETURN_KEY)
    localStorage.removeItem(RETURN_KEY)
  } catch { /* storage unavailable */ }
  if (hash && hash.startsWith('#design-') && window.location.hash !== hash) window.location.hash = hash
}

export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo() } })

export const signInWithEmail = (email) =>
  supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: returnTo() } })

export const signOut = () => supabase.auth.signOut()

export const displayName = (user) =>
  user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'

/* ---------- saved designs and order history ---------- */

export async function listDesigns() {
  const { data, error } = await supabase.from('designs').select('id, product, name, preview, updated_at').order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function loadDesign(id) {
  const { data, error } = await supabase.from('designs').select('id, product, design').eq('id', id).single()
  if (error) throw error
  return data
}

export async function saveDesign({ id, product, design, name, preview }) {
  const row = { product, design, name: name || null, preview: preview || null, updated_at: new Date().toISOString() }
  const q = id ? supabase.from('designs').update(row).eq('id', id) : supabase.from('designs').insert(row)
  const { data, error } = await q.select('id').single()
  if (error) throw error
  return data.id
}

export async function deleteDesign(id) {
  const { error } = await supabase.from('designs').delete().eq('id', id)
  if (error) throw error
}

export async function recordOrder({ id, product, colour, size, total }) {
  const { error } = await supabase.from('orders').insert({ id, product, colour, size, total })
  if (error) throw error
}

export async function listOrders() {
  const { data, error } = await supabase.from('orders').select('id, product, colour, size, total, status, created_at').order('created_at', { ascending: false })
  if (error) throw error
  return data
}
