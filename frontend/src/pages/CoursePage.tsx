import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useFavorites } from '../context/FavoritesContext'

type Course = {
  id: string
  code: string
  name: string
  credits: number
  period: string
  language: string
  department: string | null
  teacher: string | null
  prerequisites: string | null
  description: string | null
}

type Review = {
  id: string
  workload: number
  difficulty: number
  teaching_quality: number
  comment: string | null
  user_name: string | null
}

const CoursePage = () => {
  const { id } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewWorkload, setReviewWorkload] = useState(3)
  const [reviewDifficulty, setReviewDifficulty] = useState(3)
  const [reviewTeachingQuality, setReviewTeachingQuality] = useState(3)
  const [user, setUser] = useState<any>(null)
  const [userCourse, setUserCourse] = useState<any>(null)
  const [showAddCourseForm, setShowAddCourseForm] = useState(false)
  const [courseStatus, setCourseStatus] = useState<string>('planned')
  const [showGradeForm, setShowGradeForm] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const { toggleFavorite, isFavorite } = useFavorites()

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single()
      
      if (data) {
        setCourse(data)
      } else {
        setError(true)
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('course_id', id)
        .order('created_at', { ascending: false })
      
      setReviews(reviewsData || [])

      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .eq('course_id', id)
        .order('year', { ascending: false })
      
      setExams(examsData || [])

      const currentUser = (await supabase.auth.getUser()).data.user
      if (currentUser) {
        const { data: uc } = await supabase
          .from('user_courses')
          .select('*, courses(*)')
          .eq('user_id', currentUser.id)
          .eq('course_id', id)
          .maybeSingle()
        setUserCourse(uc)
      }

      setLoading(false)
    }
    fetchData()

    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [id])

  const submitReview = async () => {
    if (!user) return
    await supabase.from('reviews').insert({
      course_id: id,
      user_id: user.id,
      workload: reviewWorkload,
      difficulty: reviewDifficulty,
      teaching_quality: reviewTeachingQuality,
      comment: reviewComment || null
    })

    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('course_id', id)
      .order('created_at', { ascending: false })
    
    setReviews(data || [])
    setShowReviewForm(false)
    setReviewComment('')
  }

  const addToPlan = async () => {
    if (!user || !course) return
    await supabase.from('user_courses').insert({
      user_id: user.id,
      course_id: course.id,
      status: courseStatus,
      period: course.period || '2025 P1',
      grade: null
    })
    setShowAddCourseForm(false)
    const { data } = await supabase
      .from('user_courses')
      .select('*, courses(*)')
      .eq('user_id', user.id)
      .eq('course_id', id)
      .maybeSingle()
    setUserCourse(data)
  }

  const submitGrade = async () => {
    if (!user || !selectedGrade) return
    await supabase.from('user_courses').update({ grade: selectedGrade }).eq('id', userCourse.id)
    const { data } = await supabase
      .from('user_courses')
      .select('*, courses(*)')
      .eq('user_id', user.id)
      .eq('course_id', id)
      .maybeSingle()
    setUserCourse(data)
    setShowGradeForm(false)
  }

  const renderPrerequisites = (text: string | null) => {
    if (!text) return ''
    return text.replace(/\[([^\]]+)\]\([^)]+\)/g, (_, name) => {
      const courseCode = name.trim().replace(/[^A-Z0-9-]/gi, '')
      if (courseCode.length < 4 || courseCode.includes('XX')) {
        return `<span class="text-gray-500">${name}</span>`
      }
      return `<a href="/search?q=${courseCode}" class="text-blue-600 hover:underline">${name}</a>`
    })
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.workload + r.difficulty + r.teaching_quality) / 3, 0) / reviews.length).toFixed(1)
    : null

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (error || !course) return <div className="p-8 text-center text-gray-400">Course not found</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Back to home</Link>
        
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-sm text-blue-600 font-mono">{course.code}</span>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">{course.name}</h1>
            </div>
            <button
              onClick={() => toggleFavorite(course.id)}
              className="text-gray-400 hover:text-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isFavorite(course.id) ? "black" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
          
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
            <span>{course.credits} credits</span>
            {course.period && <span>{course.period}</span>}
            {course.language && <span>{course.language}</span>}
            {course.department && <span>{course.department}</span>}
          </div>

          {course.description && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
              <p className="text-gray-600 text-sm">{course.description}</p>
            </div>
          )}

          {course.teacher && (
            <p className="text-gray-500 text-sm mt-4">Teacher: {course.teacher}</p>
          )}

          {course.prerequisites && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Prerequisites</h3>
              <p 
                className="text-gray-600 text-sm"
                dangerouslySetInnerHTML={{ __html: renderPrerequisites(course.prerequisites) || '' }}
              />
            </div>
          )}

          {userCourse && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium capitalize">{userCourse.status}</span>
                {userCourse.grade && (
                  <span className="text-sm">Grade: {userCourse.grade}</span>
                )}
              </div>
              {userCourse.status === 'planned' && !userCourse.grade && (
                <button
                  onClick={() => setShowGradeForm(true)}
                  className="mt-2 text-sm text-[#0065BD] hover:underline"
                >
                  Add Grade
                </button>
              )}
            </div>
          )}

          {showGradeForm && (
            <div className="mt-3 p-3 bg-gray-50 rounded">
              <p className="text-sm mb-2">Select grade:</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(g)}
                    className={`w-8 h-8 rounded ${selectedGrade === g ? 'bg-[#0065BD] text-white' : 'bg-white border'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={submitGrade} className="px-3 py-1 bg-[#0065BD] text-white text-sm rounded">Save</button>
                <button onClick={() => setShowGradeForm(false)} className="px-3 py-1 border text-sm rounded">Cancel</button>
              </div>
            </div>
          )}

          {!userCourse && user && !showAddCourseForm && (
            <button
              onClick={() => setShowAddCourseForm(true)}
              className="mt-4 px-4 py-2 bg-[#0065BD] text-white text-sm rounded hover:bg-[#0055a3]"
            >
              Add to Plan
            </button>
          )}

          {showAddCourseForm && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm mb-2">Add to:</p>
              <div className="flex gap-2">
                {['completed', 'current', 'planned'].map(status => (
                  <button
                    key={status}
                    onClick={() => { setCourseStatus(status); addToPlan() }}
                    className="px-3 py-1 border text-sm rounded capitalize"
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddCourseForm(false)} className="mt-2 text-sm text-gray-500">Cancel</button>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Reviews</h2>
            {avgRating && (
              <span className="text-sm font-medium text-gray-500">Average: {avgRating}/5</span>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex gap-4 text-xs text-gray-500 mb-2">
                    <span>Workload: {review.workload}</span>
                    <span>Difficulty: {review.difficulty}</span>
                    <span>Teaching: {review.teaching_quality}</span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No reviews yet</p>
          )}

          {user && !showReviewForm && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="mt-4 px-4 py-2 bg-[#0065BD] text-white text-sm rounded hover:bg-[#0055a3]"
            >
              Write a Review
            </button>
          )}

          {showReviewForm && (
            <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded">
              <div>
                <label className="text-xs text-gray-500">Workload</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setReviewWorkload(n)}
                      className={`w-8 h-8 rounded ${reviewWorkload === n ? 'bg-[#0065BD] text-white' : 'bg-white border'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Difficulty</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setReviewDifficulty(n)}
                      className={`w-8 h-8 rounded ${reviewDifficulty === n ? 'bg-[#0065BD] text-white' : 'bg-white border'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Teaching Quality</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      onClick={() => setReviewTeachingQuality(n)}
                      className={`w-8 h-8 rounded ${reviewTeachingQuality === n ? 'bg-[#0065BD] text-white' : 'bg-white border'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Comment (optional)"
                className="w-full p-2 border rounded text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={submitReview}
                  className="px-4 py-2 bg-[#0065BD] text-white text-sm rounded"
                >
                  Submit
                </button>
                <button
                  onClick={() => setShowReviewForm(false)}
                  className="px-4 py-2 border text-sm rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {exams.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Past Exams</h2>
            <div className="space-y-2">
              {exams.map((exam) => (
                <div key={exam.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{exam.year}</span>
                    {exam.semester && <span className="text-gray-500 ml-2">{exam.semester}</span>}
                  </div>
                  {exam.url && (
                    <a href={exam.url} target="_blank" rel="noopener" className="text-[#0065BD] text-sm hover:underline">
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tenttiarkisto</h2>
          <a 
            href={`https://tenttiarkisto.fi/courses/?q=${encodeURIComponent(course.code)}`}
            target="_blank"
            rel="noopener"
            className="text-[#0065BD] text-sm hover:underline"
          >
            Search for {course.code} exams on Tenttiarkisto →
          </a>
        </div>
      </div>
    </div>
  )
}

export default CoursePage