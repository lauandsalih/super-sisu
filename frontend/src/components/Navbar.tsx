import { Link, useLocation } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'
import { supabase } from '../supabase'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const location = useLocation()
  const { favorites } = useFavorites()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#0065BD]">A!</span>
          <span className="text-lg font-bold text-black tracking-tight">Academic Planner</span>
        </Link>
        
        <nav className="flex items-center gap-8">
          <Link 
            to="/search" 
            className={`text-sm font-medium pb-2 border-b-2 ${isActive('/search') ? 'text-black border-[#0065BD]' : 'text-gray-500 border-transparent hover:text-black'}`}
          >
            Search Courses
          </Link>
          <Link 
            to="/degree" 
            className={`text-sm font-medium pb-2 border-b-2 ${isActive('/degree') ? 'text-black border-[#0065BD]' : 'text-gray-500 border-transparent hover:text-black'}`}
          >
            Academic Tracker
          </Link>
          <Link 
            to="/profile" 
            className={`text-sm font-medium pb-2 border-b-2 ${isActive('/profile') ? 'text-black border-[#0065BD]' : 'text-gray-500 border-transparent hover:text-black'}`}
          >
            My Profile
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link to="/favorites" className="relative flex items-center gap-1 text-gray-500 hover:text-black">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={favorites.length > 0 ? "black" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {favorites.length > 0 && (
              <span className="text-sm font-medium">{favorites.length}</span>
            )}
          </Link>
          <Link 
            to="/profile"
            className="px-4 py-2 text-sm font-medium border border-black rounded hover:bg-black hover:text-white transition"
          >
            {user ? 'My Profile' : 'Sign In'}
          </Link>
        </div>
      </div>
    </header>
  )
}