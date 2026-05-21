import { useState, useEffect } from 'react'
import { apiPath } from '../apiBase'
import { supabase } from '../supabase'

const romanToNum: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 }

const toRoman = (n: number): string => {
  const romans = ['I', 'II', 'III', 'IV', 'V']
  return romans[n - 1] || n.toString()
}

const convertDateToPeriod = (dateStr: string | undefined | null): string | null => {
  if (!dateStr) return null
  const months: Record<string, number> = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
  }
  const match = dateStr.match(/(\d+)\s+([a-z]+)\s+(\d{4})/i)
  if (!match) return dateStr
  const monthName = match[2].toLowerCase()
  const year = parseInt(match[3])
  const month = months[monthName]
  if (!month) return dateStr
  let academicYear: number, periodNum: number
  if (month >= 9 && month <= 10) { academicYear = year; periodNum = 1 }
  else if (month >= 11 && month <= 12) { academicYear = year; periodNum = 2 }
  else if (month <= 2) { academicYear = year - 1; periodNum = 3 }
  else if (month <= 5) { academicYear = year - 1; periodNum = 4 }
  else if (month <= 7) { academicYear = year - 1; periodNum = 5 }
  else { academicYear = year; periodNum = 0 }
  const nextYear = (academicYear + 1).toString().slice(-2)
  const periodStr = periodNum === 0 ? 'Summer' : toRoman(periodNum)
  return `${academicYear}-${nextYear} ${periodStr}`
}

const formatPeriod = (period: string | null): string => {
  if (!period) return ''
  let result = period.trim()
  const match = result.match(/^(\d{4})\s*-\s*([IV]+|[1-5])$/i)
  if (match) {
    const p = match[2].toUpperCase()
    const pNum = romanToNum[p] || parseInt(match[2])
    result = match[1] + ' ' + toRoman(pNum)
  }
  return result
}

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
  const [showAddCourseModal, setShowAddCourseModal] = useState(false)
  const [addCourseSearch, setAddCourseSearch] = useState('')
  const [addCourseResults, setAddCourseResults] = useState<any[]>([])
  const [addCourseSelected, setAddCourseSelected] = useState<any>(null)
  const [addCourseGrade, setAddCourseGrade] = useState<string>('')
  const [addCoursePeriod, setAddCoursePeriod] = useState<string>('')
  const [addCourseStatus, setAddCourseStatus] = useState<string>('completed')
  const [courseList, setCourseList] = useState<any[]>([])
  const [timedOut, setTimedOut] = useState(false)
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      setUser(user)
      
      if (user) {
        const { data } = await supabase
          .from('user_courses')
          .select('*, courses(*)')
          .eq('user_id', user.id)
        if (data) setUserCourses(data)
      }
      
      setCourseList([])
      
      setLoading(false)
    }
    getUser()
  }, [])

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
    ? gradedCourses.reduce((sum, uc) => sum + ((uc.grade || 0) * (uc.courses?.credits || 0)), 0) / gradedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
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

  const updateGrade = async (id: string, grade: number | null) => {
    const { error } = await supabase
      .from('user_courses')
      .update({ grade })
      .eq('id', id)
    if (!error) {
      setUserCourses(prev => prev.map(uc => uc.id === id ? { ...uc, grade } : uc))
    }
    setEditingGradeId(null)
  }

  if (loading && !timedOut) return <div className="p-8 text-gray-400">Loading...</div>

  if (!user) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const adminMode = sessionStorage.getItem('adminMode')
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 py-12">
            <a href="/" className="text-blue-600 text-sm mb-6 block">Back to home</a>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">Dev Profile</h1>
                  <p className="text-gray-500 text-sm">Enable Admin to test PDF</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (sessionStorage.getItem('adminMode')) {
                    sessionStorage.removeItem('adminMode')
                  } else {
                    sessionStorage.setItem('adminMode', 'true')
                  }
                  window.location.reload()
                }}
                className="text-xs mt-2 px-2 py-1 rounded border"
              >
                {adminMode ? '✓ Admin ON' : 'Admin OFF'}
              </button>
            </div>
            {adminMode && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Transcript</h2>
                <p className="text-sm text-gray-500 mb-4">Upload PDF transcript to import courses.</p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="transcript-upload-dev"
                    accept=".pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadingTranscript(true)
                      setTranscriptMessage('')
                      try {
                        const fileName = `dev-user/${Date.now()}-${file.name}`
                        const uploadResult = await supabase.storage.from('transcripts').upload(fileName, file)
                        if (uploadResult.error) {
                          setTranscriptMessage('Upload failed: ' + uploadResult.error.message)
                          setUploadingTranscript(false)
                          return
                        }
                        const { data: { publicUrl } } = supabase.storage.from('transcripts').getPublicUrl(fileName)
                        setUploadingTranscript(false)
                        setTranscriptMessage('PDF uploaded! Extracting grades...')
                        setExtractingGrades(true)
                        const response = await fetch(apiPath('/api/extract-grades'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ pdfUrl: publicUrl, userId: 'dev-user' })
                        })
                        if (response.ok) {
                          const data = await response.json()
                          const withGrades = data.gradesExtracted?.filter((g: any) => g.grade !== null).map((g: any) => `${g.code}:${g.grade}`).join(', ') || 'none'
                          const totalCredits = data.gradesExtracted.reduce((sum: number, g: any) => sum + (g.credits || 0), 0)
                    const missingPeriod = data.gradesExtracted.filter((g: any) => !g.date).map((g: any) => g.code).join(', ')
                    const msg = missingPeriod ? ` Imported ${data.imported}/${data.total} courses (${totalCredits} cr). Missing period: ${missingPeriod}` : `Imported ${data.imported}/${data.total} courses (${totalCredits} credits). Grades: ${withGrades}`
                    setTranscriptMessage(msg)
                          if (data.gradesExtracted) {
                            const fakeUserCourses = data.gradesExtracted.map((g: any, i: number) => ({
                              id: `imported-${i}`,
                              user_id: 'dev-user',
                              course_id: g.code,
                              status: 'completed',
                              grade: g.grade,
                              period: convertDateToPeriod(g.date),
                              courses: { id: g.code, code: g.code, name: g.code, credits: g.credits }
                            }))
                            setUserCourses(fakeUserCourses)
                            localStorage.setItem('devUserCourses', JSON.stringify(fakeUserCourses))
                          }
                        } else {
                          setTranscriptMessage('Error extracting grades')
                        }
                      } catch (error) {
                        setTranscriptMessage(`Error: ${error instanceof Error ? error.message : 'Upload failed'}`)
                      } finally {
                        setUploadingTranscript(false)
                        setExtractingGrades(false)
                      }
                    }}
                  />
                  <label htmlFor="transcript-upload-dev" className="cursor-pointer">
                    <div className="text-4xl mb-2">📄</div>
                    <div className="text-blue-600 hover:underline">
                      {uploadingTranscript ? 'Uploading...' : 'Click to upload PDF'}
                    </div>
                  </label>
                </div>
                {transcriptMessage && (
                  <p className={`text-sm mt-3 ${transcriptMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>{transcriptMessage}</p>
                )}
                {extractingGrades && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    Extracting grades...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }
    
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Sign in Required</h1>
          <p className="text-gray-500 mb-8">Please sign in from the home page to view your profile</p>
          <a
            href="/"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-medium inline-block"
          >
            Go to Home
          </a>
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
              {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <button
                  onClick={() => {
                    if (sessionStorage.getItem('adminMode')) {
                      sessionStorage.removeItem('adminMode')
                    } else {
                      sessionStorage.setItem('adminMode', 'true')
                    }
                    alert(sessionStorage.getItem('adminMode') ? 'Admin ON - try PDF' : 'Admin OFF')
                  }}
                  className="text-xs mt-2 px-2 py-1 rounded border bg-gray-100"
                >
                  {sessionStorage.getItem('adminMode') ? '✓ Admin ON' : 'Admin OFF'}
                </button>
              )}
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
              <div className="text-sm text-gray-500">GPA</div>
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
            Upload your Aalto transcript PDF and we'll automatically extract your grades. 
            Your PDF is only used temporarily to extract data and is never permanently stored.
          </p>
          <p className="text-xs text-green-600 mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Your privacy is protected: PDF is processed in memory and immediately discarded. No transcript data is saved.
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
                
                // Allow PDF upload in production or with real user
                const isProduction = window.location.origin.includes('vercel.app')
                const isRealUser = user.id && user.id !== 'dev-user'
                
                if (!isProduction && !isRealUser) {
                  // In dev mode, check localStorage for override
                  const adminMode = sessionStorage.getItem('adminMode')
                  if (!adminMode) {
                    setTranscriptMessage('PDF upload needs Admin ON (click under your email)')
                    return
                  }
                }
                
                setUploadingTranscript(true)
                setTranscriptMessage('')
                
                try {
                  const fileName = `${user.id}/${Date.now()}-${file.name}`
                  const uploadResult = await supabase.storage
                    .from('transcripts')
                    .upload(fileName, file)
                  
                  if (uploadResult.error) {
                    setTranscriptMessage('Upload failed: ' + uploadResult.error.message)
                    setUploadingTranscript(false)
                    return
                  }

                  const { data: { publicUrl } } = supabase.storage
                    .from('transcripts')
                    .getPublicUrl(fileName)

                  setUploadingTranscript(false)
                  setTranscriptMessage('PDF uploaded! Extracting grades...')
                  setExtractingGrades(true)

                  const response = await fetch(apiPath('/api/extract-grades'), {
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
                    const totalCredits = data.gradesExtracted.reduce((sum: number, g: any) => sum + (g.credits || 0), 0)
                    const missingPeriod = data.gradesExtracted.filter((g: any) => !g.date).map((g: any) => g.code).join(', ')
                    const msg = missingPeriod ? `Imported ${data.imported}/${data.total} courses (${totalCredits} cr). Missing period: ${missingPeriod}` : `Imported ${data.imported}/${data.total} courses (${totalCredits} credits). Grades found: ${withGrades}`
                    setTranscriptMessage(msg)
                    
                    // Save imported courses to localStorage in dev mode, or fetch from Supabase in prod
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                      // Save response data to dev courses
                      if (data.gradesExtracted) {
                        const fakeUserCourses = data.gradesExtracted.map((g: any, i: number) => ({
                          id: `imported-${i}`,
                          user_id: user.id,
                          course_id: g.code,
                          status: 'completed',
                          grade: g.grade,
                          period: convertDateToPeriod(g.date),
                          courses: { id: g.code, code: g.code, name: g.code, credits: g.credits }
                        }))
                        setUserCourses(fakeUserCourses)
                        localStorage.setItem('devUserCourses', JSON.stringify(fakeUserCourses))
                      }
                    } else {
                      const { data: updatedCourses } = await supabase
                        .from('user_courses')
                        .select('*, courses(*)')
                        .eq('user_id', user.id)
                      if (updatedCourses) setUserCourses(updatedCourses)
                    }
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
                {uploadingTranscript ? 'Uploading...' : 'Click to upload PDF transcript (in English)'}
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
              <button
                onClick={() => {
                  const data = JSON.stringify(userCourses, null, 2)
                  const blob = new Blob([data], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'my-courses-backup.json'
                  a.click()
                }}
                className="text-sm px-3 py-1 rounded border text-gray-600 hover:bg-gray-50"
              >
                Export
              </button>
              <label className="text-sm px-3 py-1 rounded border text-gray-600 hover:bg-gray-50 cursor-pointer">
                Import
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      try {
                        const imported = JSON.parse(event.target?.result as string)
                        setUserCourses(imported)
                        localStorage.setItem('devUserCourses', JSON.stringify(imported))
                      } catch {
                        alert('Invalid file')
                      }
                    }
                    reader.readAsText(file)
                  }}
                />
              </label>
              <button
                onClick={() => setShowAddCourseModal(true)}
                className="text-sm px-3 py-1 rounded bg-[#0065BD] text-white hover:bg-[#0055a3]"
              >
                + Add Course
              </button>
            </div>
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
                    <div className="text-sm text-gray-500">{uc.courses?.credits} credits{formatPeriod(uc.period) && ` • ${formatPeriod(uc.period)}`}</div>
                  </div>
                  {uc.status === 'completed' && (
                    <div className="flex flex-col items-center gap-1">
                      {editingGradeId === uc.id ? (
                        <select
                          autoFocus
                          defaultValue={uc.grade ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            updateGrade(uc.id, val === '' ? null : parseInt(val))
                          }}
                          onBlur={() => setEditingGradeId(null)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="">No grade</option>
                          <option value="5">5</option>
                          <option value="4">4</option>
                          <option value="3">3</option>
                          <option value="2">2</option>
                          <option value="1">1</option>
                        </select>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingGradeId(uc.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Modify grade
                          </button>
                          <span className={`text-2xl font-bold ${uc.grade !== null ? 'text-green-600' : 'text-gray-300'}`}>
                            {uc.grade !== null ? uc.grade : '—'}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">Add Course to My Courses</h3>
            
            <input
              type="text"
              placeholder="Search course by code or name..."
              value={addCourseSearch}
              onChange={async (e) => {
                setAddCourseSearch(e.target.value)
                if (e.target.value.length >= 2) {
                  const q = e.target.value.toLowerCase()
                  const { data } = await supabase
                    .from('courses')
                    .select('id, code, name, credits')
                    .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
                    .limit(10)
                  setAddCourseResults(data || [])
                } else {
                  setAddCourseResults([])
                }
              }}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            
            {addCourseResults.length > 0 && (
              <div className="max-h-40 overflow-auto mb-4 border rounded">
                {addCourseResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setAddCourseSelected(c)
                      setAddCourseSearch(c.code + ' - ' + c.name)
                      setAddCourseResults([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b text-sm"
                  >
                    <span className="font-mono text-blue-600">{c.code}</span>
                    <span className="ml-2 text-gray-600">{c.name}</span>
                    <span className="ml-2 text-gray-400">({c.credits} cr)</span>
                  </button>
                ))}
              </div>
            )}
            
            {addCourseSelected && (
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <select
                    value={addCourseStatus}
                    onChange={(e) => setAddCourseStatus(e.target.value)}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="completed">Completed</option>
                    <option value="current">Current</option>
                    <option value="planned">Planned</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Period (e.g., 2024-2025 I)"
                    value={addCoursePeriod}
                    onChange={(e) => setAddCoursePeriod(e.target.value)}
                    className="border rounded px-3 py-2 text-sm flex-1"
                  />
                </div>
                <select
                  value={addCourseGrade}
                  onChange={(e) => setAddCourseGrade(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Grade (optional)</option>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </div>
            )}
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddCourseModal(false)
                  setAddCourseSelected(null)
                  setAddCourseSearch('')
                }}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user || !addCourseSelected) return
                  const { error } = await supabase.from('user_courses').insert({
                    user_id: user.id,
                    course_id: addCourseSelected.id,
                    status: addCourseStatus,
                    period: addCoursePeriod || null,
                    grade: addCourseGrade ? parseInt(addCourseGrade) : null
                  })
                  if (!error) {
                    setShowAddCourseModal(false)
                    setAddCourseSelected(null)
                    window.location.reload()
                  }
                }}
                disabled={!addCourseSelected}
                className="px-4 py-2 text-sm bg-[#0065BD] text-white rounded hover:bg-[#0055a3] disabled:opacity-50"
              >
                Add Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
