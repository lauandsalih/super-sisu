import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'

const Home = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [magicEmail, setMagicEmail] = useState('')
  const [sendingMagic, setSendingMagic] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState('')

useEffect(() => {
    const getUser = async () => {
      // ALWAYS use real Supabase auth - session persists in browser
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
      }
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleGoogleLogin = async () => {
const redirectUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5173/degree' 
    : `${window.location.origin}/degree`
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!magicEmail) return

    setSendingMagic(true)
    setMagicError('')

    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: {
        emailRedirectTo: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:5173/degree' 
          : `${window.location.origin}/degree`,
      },
    })

    if (error) {
      setMagicError(error.message)
    } else {
      setMagicSent(true)
    }
    setSendingMagic(false)
  }

  const handleSignOut = async () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <div className="text-center py-16">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Dev-only: automatic sign-in for localhost
  if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && !user) {
    // Show helpful message for dev
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <section className="text-center py-16">
          <h1 className="text-5xl font-extrabold text-black mb-4 tracking-tight">
            SuperSisu Dev Mode
          </h1>
          <p className="text-xl text-gray-500 mb-8">
            Local development - sign in required
          </p>
        </section>

        <section className="mb-12 max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-400">Or</span>
              </div>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                placeholder="firstname.lastname@aalto.fi"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0065BD] text-gray-700"
                required
              />
              <button
                type="submit"
                disabled={sendingMagic}
                className="w-full px-4 py-3 bg-[#0065BD] text-white rounded-lg hover:bg-[#0055a3] transition font-medium disabled:opacity-50"
              >
                {sendingMagic ? 'Sending...' : 'Send Magic Link'}
              </button>
            </form>

            {magicSent && (
              <p className="text-sm text-green-600 text-center mt-3">
                Check your email for the login link!
              </p>
            )}
            {magicError && (
              <p className="text-sm text-red-600 text-center mt-3">
                {magicError}
              </p>
            )}
            <p className="text-xs text-gray-400 text-center mt-3">
              We'll send a secure login link to your inbox.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div className="grid grid-cols-3 gap-6 pointer-events-none opacity-50">
            <div className="block p-6 bg-white border-2 border-gray-200 rounded-lg text-center cursor-not-allowed">
              <h3 className="text-xl font-bold text-black mb-2">Academic Tracker</h3>
              <p className="text-sm text-gray-500">Plan your semesters</p>
            </div>
            <div className="block p-6 bg-white border-2 border-gray-200 rounded-lg text-center cursor-not-allowed">
              <h3 className="text-xl font-bold text-black mb-2">My Profile</h3>
              <p className="text-sm text-gray-500">View your courses & grades</p>
            </div>
            <Link to="/search" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
              <h3 className="text-xl font-bold text-black mb-2">Search Courses</h3>
              <p className="text-sm text-gray-500">Browse all Aalto courses</p>
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-extrabold text-black mb-4 tracking-tight">
          Master Your Studies at Aalto.
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          Track progress, plan semesters, and explore reviews.
        </p>
      </section>

      {!user && (
        <section className="mb-12 max-w-md mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-400">Or</span>
                </div>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-3">
                <input
                  type="email"
                  placeholder="firstname.lastname@aalto.fi"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0065BD] text-gray-700"
                  required
                />
                <button
                  type="submit"
                  disabled={sendingMagic}
                  className="w-full px-4 py-3 bg-[#0065BD] text-white rounded-lg hover:bg-[#0055a3] transition font-medium disabled:opacity-50"
                >
                  {sendingMagic ? 'Sending...' : 'Send Magic Link'}
                </button>
              </form>

              {magicSent && (
                <p className="text-sm text-green-600 text-center">
                  Check your email for the login link!
                </p>
              )}
              {magicError && (
                <p className="text-sm text-red-600 text-center">
                  {magicError}
                </p>
              )}
              <p className="text-xs text-gray-400 text-center">
                We'll send a secure login link to your inbox.
              </p>
            </div>
          </div>
        </section>
      )}

      {user && (
        <section className="mb-8">
          <div className="flex justify-between items-center max-w-md mx-auto mb-6">
            <p className="text-sm text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{user.email}</span>
            </p>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="grid grid-cols-3 gap-6">
          <Link to="/degree" className={`block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer ${user ? '' : 'opacity-60'}`}>
            <h3 className="text-xl font-bold text-black mb-2">Academic Tracker</h3>
            <p className="text-sm text-gray-500">Plan your semesters</p>
          </Link>
          <Link to="/profile" className={`block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer ${user ? '' : 'opacity-60'}`}>
            <h3 className="text-xl font-bold text-black mb-2">My Profile</h3>
            <p className="text-sm text-gray-500">View your courses & grades</p>
          </Link>
          <Link to="/search" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
            <h3 className="text-xl font-bold text-black mb-2">Search Courses</h3>
            <p className="text-sm text-gray-500">Browse all Aalto courses</p>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default Home