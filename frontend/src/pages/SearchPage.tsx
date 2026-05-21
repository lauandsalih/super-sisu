import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useFavorites } from '../context/FavoritesContext'

type Course = {
  id: string
  code: string
  name: string
  credits: number
  period: string
  language: string
  major: string
  department: string | null
  avg_grade: number | null
}

type CourseReviewStats = {
  [courseId: string]: { 
    avgRating: number; 
    ratingCount: number
    avgGrade: number | null;
    gradeCount: number
  }
}

const DEPARTMENTS = [
  'MS', 'CS', 'ELEC', 'PHYS', 'CHEM', 'TU', 'KON', 'CIV', 'MAA',
  'MUO', 'ARK', 'BIZ', 'ECON', 'FIN', 'ISM', 'MGT', 'MARK', 'ENE',
  'BIO', 'NBE', 'ART', 'FILM', 'ICT', 'LC', 'SCI', 'ENG', 'OTHER'
]

const PAGE_SIZE = 50

const SearchPage = () => {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [showMoreDepts, setShowMoreDepts] = useState(false)
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [reviewStats, setReviewStats] = useState<CourseReviewStats>({})
  const [myCourseIds, setMyCourseIds] = useState<Set<string>>(new Set())
  const [showMyCourses, setShowMyCourses] = useState(false)
  const { toggleFavorite, isFavorite } = useFavorites()

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    setPage(0)
  }, [query, selectedDepartments, selectedLevels])

  const getCourseLevel = (code: string): string => {
    if (!code) return ''
    if (code.includes('-E')) return 'msc'
    if (code.includes('-A') || code.includes('-C') || code.includes('-B')) return 'bsc'
    return ''
  }

  const fetchCourses = async () => {
    setLoading(true)
    let allData: Course[] = []
    let coursePage = 0
    const pageSize = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .range(coursePage * pageSize, (coursePage + 1) * pageSize - 1)
      
      if (error || !data || data.length === 0) break
      allData = [...allData, ...data]
      coursePage++
    }
    
    setAllCourses(allData)

    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('course_id, workload, difficulty, teaching_quality, grade')
    
    if (reviewsData) {
      const stats: { [courseId: string]: { ratingSum: number; ratingCount: number; gradeSum: number; gradeCount: number } } = {}
      reviewsData.forEach(r => {
        if (!stats[r.course_id]) {
          stats[r.course_id] = { ratingSum: 0, ratingCount: 0, gradeSum: 0, gradeCount: 0 }
        }
        const rating = (r.workload + r.difficulty + r.teaching_quality) / 3
        if (rating > 0) {
          stats[r.course_id].ratingSum += rating
          stats[r.course_id].ratingCount++
        }
        if (r.grade !== null) {
          stats[r.course_id].gradeSum += r.grade
          stats[r.course_id].gradeCount++
        }
      })
      const finalStats: CourseReviewStats = {}
      Object.keys(stats).forEach(id => {
        finalStats[id] = {
          avgRating: stats[id].ratingCount > 0 ? Math.round((stats[id].ratingSum / stats[id].ratingCount) * 10) / 10 : 0,
          ratingCount: stats[id].ratingCount,
          avgGrade: stats[id].gradeCount > 0 ? Math.round((stats[id].gradeSum / stats[id].gradeCount) * 10) / 10 : null,
          gradeCount: stats[id].gradeCount
        }
      })
      setReviewStats(finalStats)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userCoursesData } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id)
      if (userCoursesData) {
        setMyCourseIds(new Set(userCoursesData.map(uc => uc.course_id)))
      }
    }
    
    setLoading(false)
  }

  const filteredCourses = useMemo(() => {
    let filtered = allCourses

    if (showMyCourses) {
      filtered = filtered.filter(c => myCourseIds.has(c.id))
    }

    if (query.trim() !== '') {
      const q = query.toLowerCase()
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q)
      )
    }

    if (selectedDepartments.length > 0) {
      filtered = filtered.filter(c =>
        c.department && selectedDepartments.includes(c.department)
      )
    }

    if (selectedLevels.length > 0) {
      filtered = filtered.filter(c =>
        selectedLevels.includes(getCourseLevel(c.code))
      )
    }

    return filtered
  }, [allCourses, query, selectedDepartments, selectedLevels, showMyCourses, myCourseIds])

  const totalPages = Math.ceil(filteredCourses.length / PAGE_SIZE)
  const paginatedCourses = filteredCourses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleFilter = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value))
    } else {
      setSelected([...selected, value])
    }
  }

  const clearFilters = () => {
    setSelectedDepartments([])
    setSelectedLevels([])
    setQuery('')
    setPage(0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/" className="text-blue-600 text-sm mb-6 block">Back to home</a>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Search Courses</h1>
        <p className="text-gray-500 mb-2">Find Aalto courses, read or leave reviews</p>
        <p className="text-xs text-orange-600 mb-6 bg-orange-50 p-2 rounded">
          Note: This list contains courses from the official public Aalto courses API translated to English. It may lack some course implementations or information.
        </p>
        
        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course name or code..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex justify-between items-center mb-4 pb-4 border-b">
            <button
              onClick={() => setShowMyCourses(!showMyCourses)}
              className={`text-sm px-4 py-2 rounded-full border transition ${
                showMyCourses
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-purple-600 border-purple-300 hover:border-purple-400'
              }`}
            >
              My Courses ({myCourseIds.size})
            </button>
          </div>
          
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Department</h3>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.slice(0, showMoreDepts ? DEPARTMENTS.length : 8).map((dept) => (
                <button
                  key={dept}
                  onClick={() => toggleFilter(dept, selectedDepartments, setSelectedDepartments)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${
                    selectedDepartments.includes(dept)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMoreDepts(!showMoreDepts)}
              className="text-xs text-blue-600 hover:underline mt-2"
            >
              {showMoreDepts ? 'Show less' : `Show all ${DEPARTMENTS.length} departments`}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Level</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleFilter('bsc', selectedLevels, setSelectedLevels)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  selectedLevels.includes('bsc')
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                }`}
              >
                BSc
              </button>
              <button
                onClick={() => toggleFilter('msc', selectedLevels, setSelectedLevels)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  selectedLevels.includes('msc')
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}
              >
                MSc
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">
                {filteredCourses.length} courses found
                {filteredCourses.length > PAGE_SIZE && ` (showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, filteredCourses.length)})`}
              </p>
              {(selectedDepartments.length > 0 || selectedLevels.length > 0 || query) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {paginatedCourses.map((course) => (
                <a
                  key={course.id}
                  href={"/course/" + course.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 block hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-600 font-mono">{course.code}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleFavorite(course.id)
                        }}
                        className="text-gray-400 hover:text-black"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isFavorite(course.id) ? "black" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {reviewStats[course.id]?.avgGrade && (
                        <span className="text-green-600 text-sm font-medium">
                          Grade: {reviewStats[course.id].avgGrade}
                        </span>
                      )}
                      {reviewStats[course.id]?.ratingCount > 0 && (
                        <span className="text-yellow-400 text-sm">
                          ★ {reviewStats[course.id].avgRating} ({reviewStats[course.id].ratingCount})
                        </span>
                      )}
                      <span className="text-sm text-gray-500">{course.credits} cr</span>
                    </div>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">{course.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      getCourseLevel(course.code) === 'bsc' 
                        ? 'bg-green-100 text-green-700' 
                        : getCourseLevel(course.code) === 'msc'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getCourseLevel(course.code) === 'bsc' ? 'BSc' : getCourseLevel(course.code) === 'msc' ? 'MSc' : 'Other'}
                    </span>
                    {course.department && (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {course.department}
                      </span>
                    )}
                    {course.period && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                        Period {course.period}
                      </span>
                    )}
                    {course.language && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                        {course.language}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>

            {filteredCourses.length === 0 && (
              <p className="text-gray-400 text-center mt-12">No courses found</p>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SearchPage
