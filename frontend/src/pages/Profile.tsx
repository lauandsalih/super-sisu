import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

type UserCourse = {
  id: string
  course_id: string
  status: 'completed' | 'current' | 'planned'
  grade: number | null
  period: string | null
  courses: {
    id: string
    code: string
    name: string
    credits: number
  }
}

const Profile = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userCourses, setUserCourses] = useState<UserCourse[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [uploadingTranscript, setUploadingTranscript] = useState(false)
  const [transcriptMessage, setTranscriptMessage] = useState<string>('')
  const [extractingGrades, setExtractingGrades] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [degreeType, setDegreeType] = useState<'bachelor' | 'master'>('bachelor')
  const [showDegreeDetails, setShowDegreeDetails] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Use API endpoint to bypass RLS issues
        try {
          const res = await fetch(`/api/user-courses/${user.id}`)
          const json = await res.json()
          if (json.data) setUserCourses(json.data)
        } catch (e) {
          console.error('Failed to fetch courses:', e)
          // Fallback to direct query
          const { data } = await supabase
            .from('user_courses')
            .select('*, courses(*)')
            .eq('user_id', user.id)
          if (data) setUserCourses(data)
        }
      }
      
      setLoading(false)
    }
    getUser()
  }, [])

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserCourses([])
  }

  const getPeriods = () => {
    const periods = new Set<string>()
    userCourses.forEach(uc => {
      if (uc.period) periods.add(uc.period)
    })
    return Array.from(periods).sort()
  }

  const filteredCourses = userCourses.filter(uc => {
    if (selectedStatus !== 'all' && uc.status !== selectedStatus) return false
    if (selectedPeriod && uc.period !== selectedPeriod) return false
    return true
  })

  const gradedCourses = userCourses.filter(uc => uc.grade !== null)
  const totalCredits = userCourses
    .filter(uc => uc.status === 'completed')
    .reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)

  const avgGrade = gradedCourses.length > 0
    ? gradedCourses.reduce((sum, uc) => sum + (uc.grade || 0), 0) / gradedCourses.length
    : 0

  const deleteSelectedCourses = async () => {
    if (!user || selectedCourses.size === 0) return
    
    const idsToDelete = Array.from(selectedCourses)
    const { error } = await supabase
      .from('user_courses')
      .delete()
      .in('id', idsToDelete)
    
    if (!error) {
      setUserCourses(userCourses.filter(uc => !selectedCourses.has(uc.id)))
      setDeleteMode(false)
      setSelectedCourses(new Set())
    }
  }

  const toggleCourseSelection = (id: string) => {
    const newSelected = new Set(selectedCourses)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedCourses(newSelected)
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Sign in to Super Sisu</h1>
          <p className="text-gray-500 mb-8">Connect with your Aalto account to track your courses and grades</p>
          <button
            onClick={handleSignIn}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Sign in with Aalto
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/" className="text-blue-600 text-sm mb-6 block">Back to home</a>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">My Profile</h1>
              <p className="text-gray-500 text-sm">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:underline"
            >
              Sign out
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalCredits}</div>
              <div className="text-sm text-gray-500">Credits Earned</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {avgGrade > 0 ? avgGrade.toFixed(2) : '-'}
              </div>
              <div className="text-sm text-gray-500">Avg Grade</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{userCourses.filter(uc => uc.status === 'completed').length}</div>
              <div className="text-sm text-gray-500">Courses Done</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{userCourses.filter(uc => uc.status === 'planned').length}</div>
              <div className="text-sm text-gray-500">Planned</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Degree Progress</h2>
            <select
              value={degreeType}
              onChange={(e) => setDegreeType(e.target.value as 'bachelor' | 'master')}
              className="text-sm border rounded px-3 py-1"
            >
              <option value="bachelor">Bachelor's</option>
              <option value="master">Master's</option>
            </select>
          </div>
          
          {(() => {
            const targetCredits = degreeType === 'bachelor' ? 180 : 120
            const completedCredits = userCourses
              .filter(uc => uc.status === 'completed')
              .reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
            const percentage = Math.min((completedCredits / targetCredits) * 100, 100)
            
            return (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{completedCredits} / {targetCredits} credits</span>
                  <span className="text-gray-500">{percentage.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                
                <button
                  onClick={() => setShowDegreeDetails(!showDegreeDetails)}
                  className="mt-4 text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  {showDegreeDetails ? '▼' : '▶'} View breakdown
                </button>
                
                {showDegreeDetails && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span className="font-medium">{completedCredits} cr</span>
                    </div>
                    <div className="flex justify-between">
                      <span>In Progress</span>
                      <span className="font-medium">
                        {userCourses.filter(uc => uc.status === 'current').reduce((s, uc) => s + (uc.courses?.credits || 0), 0)} cr
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Planned</span>
                      <span className="font-medium">
                        {userCourses.filter(uc => uc.status === 'planned').reduce((s, uc) => s + (uc.courses?.credits || 0), 0)} cr
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Remaining</span>
                      <span>{Math.max(0, targetCredits - completedCredits)} cr</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Transcript</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload your Aalto transcript PDF and we'll automatically extract your grades
          </p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              id="transcript-upload"
              accept=".pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                console.log('File selected:', file, 'User:', user)
                if (!file || !user) {
                  console.log('Missing file or user')
                  return
                }
                
                setUploadingTranscript(true)
                setTranscriptMessage('')
                
                try {
                  const fileName = `${user.id}/${Date.now()}-${file.name}`
                  console.log('Uploading to:', fileName)
                  const { data, error: uploadError } = await supabase.storage
                    .from('transcripts')
                    .upload(fileName, file)
                  

                  console.log('Upload result:', { data, error: uploadError })
                  if (uploadError) {
                    console.error('Upload error:', uploadError)
                    setTranscriptMessage(`Upload error: ${uploadError.message}`)
                    setUploadingTranscript(false)
                    return
                  }
                  
                  const { data: { publicUrl } } = supabase.storage
                    .from('transcripts')
                    .getPublicUrl(fileName)
                  
                  setTranscriptMessage('PDF uploaded! Extracting grades...')
            setExtractingGrades(false)
                  
                  const response = await fetch('/api/extract-grades', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      pdfUrl: publicUrl,
                      userId: user.id 
                    })
                  })
                  
                  if (response.ok) {
                    const data = await response.json()
                    const withGrades = data.gradesExtracted?.filter((g: any) => g.grade !== null).map((g: any) => `${g.code}:${g.grade}`).join(', ') || 'none'
                    setTranscriptMessage(`Imported ${data.imported}/${data.total}. Grades found: ${withGrades}`)
                    
                    const { data: updatedCourses } = await supabase
                      .from('user_courses')
                      .select('*, courses(*)')
                      .eq('user_id', user.id)
                    if (updatedCourses) setUserCourses(updatedCourses)
                  } else {
                    setTranscriptMessage('Error extracting grades. Please try again.')
                  }
                } catch (error) {
                  console.error('Upload error:', error)
                  setTranscriptMessage(`Error: ${error instanceof Error ? error.message : 'Upload failed'}`)
                } finally {
                  setUploadingTranscript(false)
                  setExtractingGrades(false)
                }
              }}
            />
            
            <label htmlFor="transcript-upload" className="cursor-pointer">
              <div className="text-4xl mb-2">📄</div>
              <div className="text-blue-600 hover:underline">
                {uploadingTranscript ? 'Uploading...' : 'Click to upload PDF transcript'}
              </div>
            </label>
          </div>
          
          {transcriptMessage && (
            <p className={`text-sm mt-3 ${transcriptMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
              {transcriptMessage}
            </p>
          )}
          
          {extractingGrades && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              Extracting grades from your transcript...
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Courses</h2>
            <div className="flex gap-2">
              {userCourses.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      if (deleteMode && selectedCourses.size > 0) {
                        deleteSelectedCourses()
                      } else {
                        setDeleteMode(!deleteMode)
                        setSelectedCourses(new Set())
                      }
                    }}
                    className={`text-sm px-3 py-1 rounded ${
                      deleteMode && selectedCourses.size > 0
                        ? 'bg-red-600 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {deleteMode && selectedCourses.size > 0
                      ? `Delete ${selectedCourses.size} course(s)`
                      : deleteMode
                      ? 'Cancel'
                      : 'Delete courses'}
                  </button>
                  {deleteMode && (
                    <button
                      onClick={async () => {
                        if (!user) return
                        const { error } = await supabase
                          .from('user_courses')
                          .delete()
                          .eq('user_id', user.id)
                        if (!error) {
                          setUserCourses([])
                          setDeleteMode(false)
                          setSelectedCourses(new Set())
                        }
                      }}
                      className="text-sm px-3 py-1 rounded text-red-600 hover:text-red-800"
                    >
                      Delete all
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-sm border rounded px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="current">Current</option>
              <option value="planned">Planned</option>
            </select>
            
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-sm border rounded px-3 py-2"
            >
              <option value="">All Periods</option>
              {getPeriods().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {filteredCourses.length === 0 ? (
            <p className="text-gray-400 text-sm">No courses found. Add courses from the course page.</p>
          ) : (
            <div className="space-y-3">
              {filteredCourses.map((uc) => (
                <div
                  key={uc.id}
                  className={`flex justify-between items-center p-4 rounded-lg ${
                    deleteMode && selectedCourses.has(uc.id)
                      ? 'bg-red-50 ring-2 ring-red-500'
                      : 'bg-gray-50'
                  }`}
                >
                  {deleteMode && (
                    <input
                      type="checkbox"
                      checked={selectedCourses.has(uc.id)}
                      onChange={() => toggleCourseSelection(uc.id)}
                      className="mr-3 h-5 w-5 text-red-600 rounded"
                    />
                  )}
                  <div className={deleteMode ? 'flex-1' : ''}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-blue-600">{uc.courses?.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        uc.status === 'completed' ? 'bg-green-100 text-green-700' :
                        uc.status === 'current' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {uc.status}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900">{uc.courses?.name}</div>
                    <div className="text-sm text-gray-500">{uc.courses?.credits} credits{uc.period && ` • ${uc.period}`}</div>
                  </div>
                  {uc.grade !== null && (
                    <div className="text-2xl font-bold text-green-600">{uc.grade}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Profile
