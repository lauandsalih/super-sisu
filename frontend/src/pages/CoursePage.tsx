import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'

type Course = {
  id: string
  code: string
  name: string
  credits: number
  period: string
  language: string
  major: string
  teacher: string
  avg_grade: number | null
  description: string
}

const CoursePage = () => {
  const { id } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCourse = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()
      if (!error && data) setCourse(data)
      setLoading(false)
    }
    fetchCourse()
  }, [id])

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!course) return <div className="p-8 text-gray-400">Course not found</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/search" className="text-blue-600 text-sm mb-6 block">Back to search</a>
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm text-blue-600 font-mono">{course.code}</span>
            <span className="text-sm text-gray-500">{course.credits} credits</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{course.name}</h1>
          <div className="flex flex-wrap gap-2 mb-6">
            {course.period && (
              <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full">
                Period {course.period}
              </span>
            )}
            {course.major && (
              <span className="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full">
                {course.major}
              </span>
            )}
            {course.language && (
              <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                {course.language}
              </span>
            )}
            {course.avg_grade && (
              <span className="bg-green-50 text-green-700 text-xs px-3 py-1 rounded-full">
                Avg grade {course.avg_grade}
              </span>
            )}
          </div>
          {course.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{course.description}</p>
          )}
          {course.teacher && (
            <p className="text-gray-500 text-sm mt-4">Teacher: {course.teacher}</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Reviews</h2>
          <p className="text-gray-400 text-sm">No reviews yet. Be the first to review this course.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Exams</h2>
          <p className="text-gray-400 text-sm">No exams uploaded yet.</p>
        </div>
      </div>
    </div>
  )
}

export default CoursePage