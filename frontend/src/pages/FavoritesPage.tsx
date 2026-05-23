import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useFavorites } from '../context/FavoritesContext'

type Course = {
  id: string
  code: string
  name: string
  credits: number
  language: string
  department: string | null
}

const FavoritesPage = () => {
  const { favorites, toggleFavorite, isFavorite } = useFavorites()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFavorites = async () => {
      if (favorites.length === 0) {
        setCourses([])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('courses')
        .select('id, code, name, credits, language, department')
        .in('id', favorites)
      if (data) setCourses(data)
      setLoading(false)
    }
    fetchFavorites()
  }, [favorites])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/search" className="text-blue-600 text-sm mb-6 block">← Back to search</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Saved Courses</h1>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-4">♡</div>
            <p className="text-gray-500 mb-2">No saved courses yet</p>
            <p className="text-sm text-gray-400">Click the heart icon on any course to save it here</p>
            <Link to="/search" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
              Browse courses →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {courses.map(course => (
              <div key={course.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-4">
                <Link to={`/course/${course.id}`} className="flex-1 hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-blue-600 font-mono">{course.code}</span>
                    {course.department && (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{course.department}</span>
                    )}
                    {course.language && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{course.language}</span>
                    )}
                  </div>
                  <h2 className="font-semibold text-gray-900">{course.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{course.credits} credits</p>
                </Link>
                <button
                  onClick={() => toggleFavorite(course.id)}
                  className="shrink-0 text-gray-400 hover:text-black transition-colors mt-1"
                  title="Remove from saved"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isFavorite(course.id) ? 'black' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FavoritesPage
