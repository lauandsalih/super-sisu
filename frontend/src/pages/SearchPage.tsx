import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

type Course = {
  id: string
  code: string
  name: string
  credits: number
  period: string
  language: string
  major: string
  avg_grade: number | null
}

const SearchPage = () => {
  const [query, setQuery] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCourses('')
  }, [])

  const fetchCourses = async (searchQuery: string) => {
    setLoading(true)
    let request = supabase.from('courses').select('*')
    if (searchQuery.trim() !== '') {
      request = request.ilike('name', '%' + searchQuery + '%')
    }
    const { data, error } = await request
    if (!error && data) setCourses(data)
    setLoading(false)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    fetchCourses(e.target.value)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/" className="text-blue-600 text-sm mb-6 block">Back to home</a>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Courses</h1>
        <p className="text-gray-500 mb-6">Find Aalto courses, teaching periods and program info</p>
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="Search by course name..."
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none mb-6"
        />
        {loading && <p className="text-gray-400">Loading...</p>}
        <div className="flex flex-col gap-4">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-blue-600">{course.code}</span>
                <span className="text-sm text-gray-500">{course.credits} cr</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{course.name}</h2>
              <div className="flex flex-wrap gap-2">
                {course.period && (
                  <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                    Period {course.period}
                  </span>
                )}
                {course.major && (
                  <span className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full">
                    {course.major}
                  </span>
                )}
                {course.language && (
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {course.language}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {!loading && courses.length === 0 && (
          <p className="text-gray-400 text-center mt-12">No courses found</p>
        )}
      </div>
    </div>
  )
}

export default SearchPage