import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, ReferenceDot } from 'recharts'

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
    period: string | null
  }
}

type SemesterData = {
  name: string
  year: number
  period: number
  completed: number
  planned: number
  cumulative: number
  cumulativeWithPlanned: number
  idealCumulative: number
  projectedCumulative: number
  gpa: number
}

type ChartDataPoint = {
  label: string
  periodLabel: string
  year: number
  actual: number
  ideal: number
  planned: number
  gpa: number
  period: number
  isCurrentOrFuture: boolean
}

const DegreePlanner = () => {
  const [loading, setLoading] = useState(true)
  const [completedCourses, setCompletedCourses] = useState<UserCourse[]>([])
  const [plannedCourses, setPlannedCourses] = useState<UserCourse[]>([])
  const [currentCourses, setCurrentCourses] = useState<UserCourse[]>([])
  const [targetCredits, setTargetCredits] = useState(180)
  const [targetGPA, setTargetGPA] = useState(4.0)
  const [goalDate, setGoalDate] = useState('')
  const [addCourseModal, setAddCourseModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<any>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('2025 P1')
  const [editingGradeModal, setEditingGradeModal] = useState(false)
  const [gradeAdjustments, setGradeAdjustments] = useState<Record<string, number | null>>({})
  const [includePlanned, setIncludePlanned] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase
          .from('user_courses')
          .select('*, courses(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (data) {
          const completed = data.filter((uc: any) => uc.status === 'completed')
          const current = data.filter((uc: any) => uc.status === 'current')
          const planned = data.filter((uc: any) => uc.status === 'planned')
          setCompletedCourses(completed)
          setCurrentCourses(current)
          setPlannedCourses(planned)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const toRoman = (n: number): string => {
    const romans = ['I', 'II', 'III', 'IV', 'V']
    return romans[n - 1] || n.toString()
  }

  const getPeriodEndMonth = (period: number): number => {
    const periodEndMonths: Record<number, number> = {
      1: 9,  // P1 ends in October
      2: 11, // P2 ends in December
      3: 1,  // P3 ends in February
      4: 3,  // P4 ends in April
      5: 5,  // P5 ends in June
      0: 7   // Summer ends in August
    }
    return periodEndMonths[period] || 11
  }

  const isPeriodEnded = (year: number, period: number): boolean => {
    const now = new Date()
    const endMonth = getPeriodEndMonth(period)
    const periodEnd = new Date(year, endMonth + 1, 1) // First day of month after end
    return now >= periodEnd
  }

  const getSortKey = (year: number, period: number): number => {
    const periodOrder: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 0: 6 }
    return year * 10 + (periodOrder[period] || 0)
  }

  // Parse period string to semester data
  const parsePeriod = (periodStr: string | null): { year: number; period: number; name: string } | null => {
    if (!periodStr) return null
    // Support both "YYYY P#" and "YYYY-YYYY P#" formats
    const match = periodStr.match(/^(\d{4})(?:-(\d{4}))?\s*[pP](\d+|Summer)$/i)
    if (!match) return null
    
    const startYear = parseInt(match[1])
    const periodNum = match[3] === 'Summer' ? 0 : parseInt(match[3])
    
    let semesterName: string
    if (periodNum === 0) {
      semesterName = `Summer ${startYear}`
    } else if (periodNum <= 2) {
      semesterName = `Fall ${startYear} (${toRoman(periodNum)})`
    } else {
      semesterName = `Spring ${startYear + 1} (${toRoman(periodNum)})`
    }
    
    return { year: startYear, period: periodNum, name: semesterName }
  }

  const buildSemesterData = (): SemesterData[] => {
    // Find min year from courses (only from completed courses for start)
    let minYear = new Date().getFullYear()
    for (const course of completedCourses) {
      const parsed = parsePeriod(course.period)
      if (parsed && parsed.year < minYear) {
        minYear = parsed.year
      }
    }
    
    if (completedCourses.length === 0) {
      minYear = new Date().getFullYear()
    }
    
    // Calculate max year - based on planned courses or 3 years from start
    let maxYear: number
    if (plannedCourses.length > 0) {
      // Find max year from planned courses
      maxYear = minYear
      for (const course of plannedCourses) {
        const parsed = parsePeriod(course.period)
        if (parsed && parsed.year > maxYear) {
          maxYear = parsed.year
        }
      }
    } else if (goalDate) {
      maxYear = new Date(goalDate).getFullYear() + 1
    } else {
      maxYear = minYear + 3
    }
    
    const allPeriods: { year: number; period: number; name: string }[] = []
    
    for (let year = minYear; year <= maxYear; year++) {
      for (let period = 1; period <= 5; period++) {
        let semName: string
        if (period <= 2) {
          semName = `Fall ${year} (${toRoman(period)})`
        } else {
          semName = `Spring ${year + 1} (${toRoman(period)})`
        }
        allPeriods.push({ year, period, name: semName })
      }
    }
    
    // Also add Summer
    for (let year = minYear; year <= maxYear; year++) {
      allPeriods.push({ year, period: 0, name: `Summer ${year}` })
    }
    
    // Sort all periods chronologically
    allPeriods.sort((a, b) => getSortKey(a.year, a.period) - getSortKey(b.year, b.period))
    
    // Build semester map from courses
    const semesterMap: Record<string, SemesterData> = {}
    
    for (const course of completedCourses) {
      const parsed = parsePeriod(course.period)
      if (!parsed) continue
      
      const key = `${parsed.year}-${parsed.period}`
      if (!semesterMap[key]) {
        semesterMap[key] = {
          name: parsed.name,
          year: parsed.year,
          period: parsed.period,
          completed: 0,
          planned: 0,
          cumulative: 0,
          cumulativeWithPlanned: 0,
          idealCumulative: 0,
          projectedCumulative: 0,
          gpa: 0
        }
      }
      semesterMap[key].completed += course.courses?.credits || 0
    }

    for (const course of plannedCourses) {
      const parsed = parsePeriod(course.period)
      if (!parsed) continue
      
      const key = `${parsed.year}-${parsed.period}`
      if (!semesterMap[key]) {
        semesterMap[key] = {
          name: parsed.name,
          year: parsed.year,
          period: parsed.period,
          completed: 0,
          planned: 0,
          cumulative: 0,
          cumulativeWithPlanned: 0,
          idealCumulative: 0,
          projectedCumulative: 0,
          gpa: 0
        }
      }
      semesterMap[key].planned += course.courses?.credits || 0
    }

    // Merge allPeriods with semesterMap
    const sortedSemesters: SemesterData[] = allPeriods.map(p => {
      const key = `${p.year}-${p.period}`
      const existing = semesterMap[key]
      return {
        name: existing?.name || p.name,
        year: p.year,
        period: p.period,
        completed: existing?.completed || 0,
        planned: existing?.planned || 0,
        cumulative: 0,
        cumulativeWithPlanned: 0,
        idealCumulative: 0,
        projectedCumulative: 0,
        gpa: 0
      }
    })
    
    let cumulativeCredits = 0
    let totalGradePoints = 0
    let totalGradedCredits = 0
    
    // Calculate total semesters from start to graduation (or 4 years from start)
    const startYear = sortedSemesters[0]?.year || new Date().getFullYear()
    const endYear = goalDate ? new Date(goalDate).getFullYear() + 1 : startYear + 4
    const totalPeriodsCount = (endYear - startYear) * 6 // 6 periods per year
    const creditsPerSemester = targetCredits / totalPeriodsCount
    
    sortedSemesters.forEach((sem, idx) => {
      // Calculate display year: I = startYear, III = startYear+1, V = startYear+1, next I = startYear+1, etc.
      let displayYear = startYear
      if (sem.period === 3 || sem.period === 4 || sem.period === 5) {
        displayYear = startYear + 1 + Math.floor(idx / 6)
      } else if (sem.period === 1 || sem.period === 2 || sem.period === 0) {
        displayYear = startYear + Math.floor(idx / 6)
      }
      sem.year = displayYear
      
      // Only count credits if period has ended - use completed only, not planned
      if (isPeriodEnded(sem.year, sem.period)) {
        cumulativeCredits += sem.completed
      }
      sem.cumulative = cumulativeCredits
      
      // Cumulative with planned includes planned courses (only up to current period)
      let cumulativeWithPlanned = cumulativeCredits
      if (isPeriodEnded(sem.year, sem.period)) {
        cumulativeWithPlanned += sem.planned
      }
      sem.cumulativeWithPlanned = cumulativeWithPlanned
      
      // Ideal line - straight diagonal from start to target
      const idealCredits = (idx + 1) * creditsPerSemester
      sem.idealCumulative = Math.min(idealCredits, targetCredits)
      
      const semesterCourses = completedCourses.filter(c => {
        const p = parsePeriod(c.period)
        return p && p.year === sem.year && p.period === sem.period
      })
      
      let semesterGradePoints = 0
      let semesterGradedCredits = 0
      for (const c of semesterCourses) {
        const grade = gradeAdjustments[c.id] !== undefined ? gradeAdjustments[c.id] : c.grade
        if (grade !== null && grade !== undefined) {
          semesterGradePoints += grade * (c.courses?.credits || 0)
          semesterGradedCredits += c.courses?.credits || 0
        }
      }
      
      if (semesterGradedCredits > 0) {
        totalGradePoints += semesterGradePoints
        totalGradedCredits += semesterGradedCredits
      }
    })
    
    // Calculate final GPA with adjustments only at the last point
    const finalGPA = totalGradedCredits > 0 ? totalGradePoints / totalGradedCredits : 0
    sortedSemesters.forEach((sem, idx) => {
      // Only show adjusted GPA at the final point
      if (idx === sortedSemesters.length - 1) {
        sem.gpa = finalGPA
      } else {
        // Recalculate GPA without adjustments for historical points
        let histGradePoints = 0
        let histGradedCredits = 0
        for (let i = 0; i <= idx; i++) {
          const s = sortedSemesters[i]
          const semCourses = completedCourses.filter(c => {
            const p = parsePeriod(c.period)
            return p && p.year === s.year && p.period === s.period
          })
          for (const c of semCourses) {
            if (c.grade !== null) {
              histGradePoints += c.grade * (c.courses?.credits || 0)
              histGradedCredits += c.courses?.credits || 0
            }
          }
        }
        sem.gpa = histGradedCredits > 0 ? histGradePoints / histGradedCredits : 0
      }
    })

    // Now filter out future periods for GPA (only show past periods)
    let foundCurrent = false
    sortedSemesters.forEach((sem) => {
      const periodEnded = isPeriodEnded(sem.year, sem.period)
      if (!periodEnded && !foundCurrent) {
        // This is the first future period - set GPA to 0 to stop the line
        sem.gpa = 0
        foundCurrent = true
      } else if (foundCurrent) {
        sem.gpa = 0
      }
    })

    return sortedSemesters
  }

  const semesterData = buildSemesterData()
  
  const buildChartData = (): ChartDataPoint[] => {
    let lastGPA = 0
    let hasGradedCredits = false
    
    const data = semesterData.map((sem, idx) => {
      const periodKey = sem.period === 0 ? 'S' : toRoman(sem.period)
      const label = `${sem.year}-${periodKey}`
      
      // GPA: carry over if no new graded credits
      if (sem.gpa > 0 || hasGradedCredits) {
        lastGPA = sem.gpa > 0 ? sem.gpa : lastGPA
        hasGradedCredits = true
      }
      
      // Ideal line: continuous from 0 to targetCredits
      const ideal = (idx / (semesterData.length - 1)) * targetCredits
      
      return {
        label,
        periodLabel: periodKey,
        year: sem.year,
        actual: sem.cumulative,
        ideal: ideal,
        planned: sem.cumulativeWithPlanned,
        gpa: lastGPA,
        period: sem.period,
        isCurrentOrFuture: !isPeriodEnded(sem.year, sem.period)
      }
    })
    return data
  }

  const chartData = buildChartData()
  
  // Find current period index based on date
  let currentPeriodIdx = chartData.length - 1
  for (let i = 0; i < chartData.length; i++) {
    const d = chartData[i]
    if (d.isCurrentOrFuture) {
      currentPeriodIdx = i - 1 >= 0 ? i - 1 : i
      break
    }
  }
  if (currentPeriodIdx < 0) currentPeriodIdx = 0
  
  const completedCredits = completedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
  const currentCredits = currentCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
  const plannedCredits = plannedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
  const remaining = Math.max(0, targetCredits - completedCredits - plannedCredits)
  const progress = ((completedCredits + plannedCredits) / targetCredits) * 100

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>
  }

  // Calculate max period index including planned courses
  // Find the last planned period from the planned courses
  let maxPlannedYear = 0
  let maxPlannedPeriod = -1
  
  for (const pc of plannedCourses) {
    const parsed = parsePeriod(pc.period)
    if (!parsed) continue
    // Compare by sort key
    const currentKey = maxPlannedYear * 10 + (maxPlannedPeriod >= 0 ? maxPlannedPeriod : 0)
    const plannedKey = parsed.year * 10 + parsed.period
    if (plannedKey > currentKey) {
      maxPlannedYear = parsed.year
      maxPlannedPeriod = parsed.period
    }
  }
  
  // Find the index in chartData for this period
  let maxPlannedIdx = -1
  if (maxPlannedPeriod >= 0) {
    maxPlannedIdx = chartData.findIndex(d => d.year === maxPlannedYear && d.period === maxPlannedPeriod)
  }
  
  const displayEndIdx = includePlanned && maxPlannedIdx >= 0 ? Math.max(maxPlannedIdx, currentPeriodIdx) : currentPeriodIdx
  const displayChartData = chartData.filter((_, i) => i <= displayEndIdx)

  // Group courses by semester for the timeline
  const getCoursesBySemester = (status: 'completed' | 'planned') => {
    const courses = status === 'completed' ? completedCourses : plannedCourses
    const grouped: Record<string, UserCourse[]> = {}
    
    for (const course of courses) {
      const parsed = parsePeriod(course.period)
      if (!parsed) continue
      const key = `${parsed.year}-${parsed.period}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(course)
    }
    
    return grouped
  }

  const completedBySemester = getCoursesBySemester('completed')
  const plannedBySemester = getCoursesBySemester('planned')

  // Build sorted semester list
  const allSemesters = Array.from(new Set([
    ...Object.keys(completedBySemester),
    ...Object.keys(plannedBySemester)
  ])).sort((a, b) => {
    const [yearA, periodA] = a.split('-').map(Number)
    const [yearB, periodB] = b.split('-').map(Number)
    if (yearA !== yearB) return yearA - yearB
    return periodA - periodB
  })

  const getSemesterName = (key: string) => {
    const [year, period] = key.split('-').map(Number)
    if (period === 0) return `Summer ${year}`
    if (period <= 2) return `Fall ${year} (${toRoman(period)})`
    return `Spring ${year + 1} (${toRoman(period)})`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Back to home</Link>
        
        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Degree Plan</h1>
          <p className="text-gray-500 text-sm">Track your progress toward graduation</p>
        </div>

        {/* Radial Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" strokeWidth="12" fill="none" className="stroke-gray-200" />
                <circle 
                  cx="64" cy="64" r="56" 
                  strokeWidth="12" fill="none" 
                  className="stroke-blue-500"
                  strokeDasharray={`${progress * 3.52} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">{completedCredits + plannedCredits}</span>
                <span className="text-xs text-gray-400">/ {targetCredits}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-semibold text-green-600">{completedCredits}</div>
              <div className="text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-600">{currentCredits}</div>
              <div className="text-gray-500">In Progress</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-purple-600">{plannedCredits}</div>
              <div className="text-gray-500">Planned</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-600">{remaining}</div>
              <div className="text-gray-500">Remaining</div>
            </div>
            <div className="text-center border-l pl-4">
              <div className="font-semibold text-black">
                {(() => {
                  const gradedCourses = completedCourses.filter((uc: any) => uc.grade != null && uc.period)
                  const gradedCredits = gradedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
                  const gradePoints = gradedCourses.reduce((sum, uc) => sum + ((uc.grade || 0) * (uc.courses?.credits || 0)), 0)
                  const gpa = gradedCredits > 0 ? gradePoints / gradedCredits : 0
                  
                  const semesterSet = new Set<string>()
                  gradedCourses.forEach((uc: any) => {
                    const period = uc.period
                    if (!period) return
                    const match = period.match(/(\d{4})\s*P([1-5])/i)
                    if (match) {
                      const year = match[1]
                      const p = parseInt(match[2])
                      const semester = p <= 2 ? `${year}-fall` : `${year}-spring`
                      semesterSet.add(semester)
                    }
                  })
                  const semesters = semesterSet.size
                  const academicIndex = gradedCredits > 0 && semesters > 0 ? (gradedCredits * gpa) / semesters : 0
                  return academicIndex.toFixed(2)
                })()}
              </div>
              <div className="text-gray-500">Academic Index</div>
            </div>
          </div>
        </div>

        {/* Target Inputs */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Target:</label>
              <input
                type="number"
                value={targetCredits}
                onChange={(e) => setTargetCredits(Number(e.target.value))}
                className="w-16 text-sm border rounded px-2 py-1"
                min="1"
              />
              <span className="text-xs text-gray-500">cr</span>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">GPA Goal:</label>
              <input
                type="number"
                step="0.1"
                value={targetGPA}
                onChange={(e) => setTargetGPA(Number(e.target.value))}
                className="w-14 text-sm border rounded px-2 py-1"
                min="1"
                max="5"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Graduation:</label>
              <input
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              />
            </div>
          </div>
        </div>

        {/* Credit Progress Graph */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Credit Progress</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includePlanned}
                  onChange={(e) => setIncludePlanned(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-600">Include planned</span>
              </label>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="periodLabel" 
                    tick={({ x, y, payload, index }) => {
                      const totalLength = displayChartData.length
                      const isLongTimeline = totalLength > 24 // More than 4 years
                      
                       // Extract period from label (e.g., "2024-I" -> "I")
                      const periodValue = payload.value
                      
                      const isFirstI = index === 0 && periodValue === 'I'
                      const isFirstIIIAfterFirstI = periodValue === 'III' && displayChartData.slice(0, index).some(d => d.periodLabel === 'I')
                      const showYear = isLongTimeline 
                        ? (periodValue === 'I' || periodValue === 'III')
                        : (isFirstI || isFirstIIIAfterFirstI)
                      const dataPoint = displayChartData[index]
                      const displayYear = dataPoint ? dataPoint.year : ''
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={0} textAnchor="middle" fill="#374151" fontSize={isLongTimeline ? 10 : 11}>
                            {periodValue}
                          </text>
                          {showYear && displayYear && (
                            <text x={0} y={14} dy={0} textAnchor="middle" fill="#9ca3af" fontSize={9}>
                              {displayYear}
                            </text>
                          )}
                        </g>
                      )
                    }} 
                    interval={0}
                    minTickGap={30}
                  />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, targetCredits]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: any) => [`${value} credits`, '']}
                    labelFormatter={(label: any) => `Period: ${label}`}
                  />
                  <Legend />
                  <ReferenceLine y={targetCredits} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                  {currentPeriodIdx >= 0 && (
                    <ReferenceLine 
                      x={displayChartData[currentPeriodIdx]?.periodLabel} 
                      stroke="#9ca3af" 
                      strokeDasharray="3 3" 
                      strokeWidth={1}
                    />
                  )}
                  {currentPeriodIdx >= 0 && (
                    <ReferenceDot 
                      x={displayChartData[currentPeriodIdx]?.periodLabel} 
                      y={displayChartData[currentPeriodIdx]?.actual} 
                      r={6} 
                      fill="#ef4444" 
                      stroke="white" 
                      strokeWidth={2} 
                    />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Actual Progress"
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    strokeLinecap="round"
                    connectNulls={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ideal" 
                    stroke="#9ca3af" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Ideal"
                    dot={false}
                    connectNulls={true}
                  />
                  {includePlanned && (
                    <Line 
                      type="monotone" 
                      dataKey="planned" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="With Planned"
                      dot={false}
                      connectNulls={true}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* GPA Tracker */}
        {chartData.some(d => d.gpa > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">GPA Progress</h2>
              <button
                onClick={() => setEditingGradeModal(true)}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                + Modify Grades
              </button>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData.filter((d, i) => i <= currentPeriodIdx && d.gpa > 0)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="periodLabel" 
                    tick={({ x, y, payload, index }) => {
                      const totalLength = displayChartData.length
                      const isLongTimeline = totalLength > 24
                      
                      const periodValue = payload.value
                      
                      const isFirstI = index === 0 && periodValue === 'I'
                      const isFirstIIIAfterFirstI = periodValue === 'III' && displayChartData.slice(0, index).some(d => d.periodLabel === 'I')
                      const showYear = isLongTimeline 
                        ? (periodValue === 'I' || periodValue === 'III')
                        : (isFirstI || isFirstIIIAfterFirstI)
                      const dataPoint = displayChartData[index]
                      const displayYear = dataPoint ? dataPoint.year : ''
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={0} textAnchor="middle" fill="#374151" fontSize={isLongTimeline ? 10 : 11}>
                            {periodValue}
                          </text>
                          {showYear && displayYear && (
                            <text x={0} y={14} dy={0} textAnchor="middle" fill="#9ca3af" fontSize={9}>
                              {displayYear}
                            </text>
                          )}
                        </g>
                      )
                    }} 
                    interval={0}
                    minTickGap={30}
                  />
                  <YAxis tick={{ fontSize: 12 }} domain={[1, 5]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: any) => [`${Number(value).toFixed(2)} GPA`, 'Cumulative GPA']}
                  />
                  <ReferenceLine y={targetGPA} stroke="#22c55e" strokeDasharray="5 5" label={`Goal (${targetGPA})`} />
                  {currentPeriodIdx >= 0 && (
                    <ReferenceLine 
                      x={displayChartData[currentPeriodIdx]?.periodLabel} 
                      stroke="#9ca3af" 
                      strokeDasharray="3 3" 
                      strokeWidth={1}
                    />
                  )}
                  {currentPeriodIdx >= 0 && (
                    <ReferenceDot 
                      x={displayChartData[currentPeriodIdx]?.periodLabel} 
                      y={displayChartData[currentPeriodIdx]?.gpa || 0} 
                      r={6} 
                      fill="#ef4444" 
                      stroke="white" 
                      strokeWidth={2} 
                    />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="gpa" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Cumulative GPA"
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    strokeLinecap="round"
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Horizontal Timeline */}
        {allSemesters.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold mb-4">Study Timeline</h2>
            <div className="overflow-x-auto">
              <div className="flex gap-3 min-w-max pb-4">
                {allSemesters.map((semesterKey) => {
                  const semCompleted = completedBySemester[semesterKey] || []
                  const semPlanned = plannedBySemester[semesterKey] || []
                  const totalCredits = [...semCompleted, ...semPlanned].reduce((s, c) => s + (c.courses?.credits || 0), 0)
                  
                  return (
                    <div key={semesterKey} className="flex flex-col min-w-[180px]">
                      <div className="text-center text-sm font-medium text-gray-700 mb-2">
                        {getSemesterName(semesterKey)}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-2 min-h-[150px] flex flex-col gap-1">
                        {semCompleted.map(uc => (
                          <div key={uc.id} className="text-xs p-1.5 bg-green-100 border border-green-300 rounded text-green-800">
                            <div className="font-medium">{uc.courses?.code}</div>
                            <div className="text-gray-600">{uc.courses?.credits}cr {uc.grade && `• ${uc.grade}`}</div>
                          </div>
                        ))}
                        {semPlanned.map(uc => (
                          <div 
                            key={uc.id} 
                            className="text-xs p-1.5 bg-purple-100 border border-purple-300 rounded text-purple-800 cursor-pointer hover:bg-purple-200"
                            onClick={async () => {
                              const newPeriod = prompt(`Enter period for ${uc.courses?.code} (e.g., 2025 P1):`, uc.period || '')
                              if (newPeriod) {
                                await supabase.from('user_courses').update({ period: newPeriod }).eq('id', uc.id)
                                window.location.reload()
                              }
                            }}
                          >
                            <div className="font-medium">{uc.courses?.code}</div>
                            <div className="text-gray-600">{uc.courses?.credits}cr (planned)</div>
                          </div>
                        ))}
                        {semCompleted.length === 0 && semPlanned.length === 0 && (
                          <div className="text-xs text-gray-400 italic p-1">No courses</div>
                        )}
                      </div>
                      <div className="text-center text-xs font-bold text-gray-700 mt-1">
                        {totalCredits} cr
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Course Buckets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Completed ({completedCourses.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-auto">
              {completedCourses.map(uc => (
                <div key={uc.id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-green-700">{uc.courses?.code}</span>
                      {uc.period && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{uc.period}</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-700">{uc.courses?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{uc.courses?.credits} cr</span>
                    {uc.grade && <span className="font-bold text-green-600">{uc.grade}</span>}
                  </div>
                </div>
              ))}
              {completedCourses.length === 0 && (
                <p className="text-sm text-gray-400">No completed courses</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-purple-700 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              Planned ({plannedCourses.length})
              <button
                onClick={() => setAddCourseModal(true)}
                className="ml-auto text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
              >
                + Add Course
              </button>
            </h3>
            <div className="space-y-2 max-h-64 overflow-auto">
              {plannedCourses.map(uc => (
                <div key={uc.id} className="flex justify-between items-center p-2 bg-purple-50 rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-700">{uc.courses?.code}</span>
                    </div>
                    <span className="text-sm text-gray-700">{uc.courses?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{uc.courses?.credits} cr</span>
                    <button
                      onClick={async () => {
                        await supabase.from('user_courses').delete().eq('id', uc.id)
                        setPlannedCourses(plannedCourses.filter(p => p.id !== uc.id))
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {plannedCourses.length === 0 && (
                <p className="text-sm text-gray-400">No planned courses</p>
              )}
            </div>
          </div>
        </div>

        {/* Add Course Modal */}
        {addCourseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="font-semibold text-lg mb-4">Add Planned Course</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Course</label>
                  <input
                    type="text"
                    placeholder="Search course code or name..."
                    className="w-full border rounded px-3 py-2"
                    onChange={async (e) => {
                      if (e.target.value.length >= 2) {
                        const { data } = await supabase
                          .from('courses')
                          .select('*')
                          .or(`code.ilike.%${e.target.value}%,name.ilike.%${e.target.value}%`)
                          .limit(20)
                        if (data) {
                          setSelectedCourse(data[0])
                        }
                      }
                    }}
                  />
                  {selectedCourse && (
                    <div className="mt-2 p-2 bg-purple-50 rounded">
                      <div className="font-medium">{selectedCourse.code}</div>
                      <div className="text-sm text-gray-600">{selectedCourse.name}</div>
                      <div className="text-xs text-gray-500">{selectedCourse.credits} credits</div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Period</label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="2024 P1">Fall 2024 (I)</option>
                    <option value="2024 P2">Fall 2024 (II)</option>
                    <option value="2024 P3">Spring 2025 (III)</option>
                    <option value="2024 P4">Spring 2025 (IV)</option>
                    <option value="2024 P5">Spring 2025 (V)</option>
                    <option value="2024 Summer">Summer 2024</option>
                    <option value="2025 P1">Fall 2025 (I)</option>
                    <option value="2025 P2">Fall 2025 (II)</option>
                    <option value="2025 P3">Spring 2026 (III)</option>
                    <option value="2025 P4">Spring 2026 (IV)</option>
                    <option value="2025 P5">Spring 2026 (V)</option>
                    <option value="2025 Summer">Summer 2025</option>
                    <option value="2026 P1">Fall 2026 (I)</option>
                    <option value="2026 P2">Fall 2026 (II)</option>
                    <option value="2026 P3">Spring 2027 (III)</option>
                    <option value="2026 P4">Spring 2027 (IV)</option>
                    <option value="2026 P5">Spring 2027 (V)</option>
                    <option value="2026 Summer">Summer 2026</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setAddCourseModal(false)
                    setSelectedCourse(null)
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (selectedCourse) {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (user) {
                        await supabase.from('user_courses').insert({
                          user_id: user.id,
                          course_id: selectedCourse.id,
                          status: 'planned',
                          period: selectedPeriod,
                          grade: null
                        })
                        const { data } = await supabase
                          .from('user_courses')
                          .select('*, courses(*)')
                          .eq('user_id', user.id)
                          .eq('status', 'planned')
                        if (data) setPlannedCourses(data)
                      }
                    }
                    setAddCourseModal(false)
                    setSelectedCourse(null)
                  }}
                  disabled={!selectedCourse}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modify Grades Modal */}
        {editingGradeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
              <h3 className="font-semibold text-lg mb-4">Modify Grades (What-if Analysis)</h3>
              <p className="text-sm text-gray-500 mb-4">Adjust grades to see how they would affect your GPA</p>
              <div className="space-y-2">
                {completedCourses.map(uc => (
                  <div key={uc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-mono text-sm">{uc.courses?.code}</span>
                      <span className="text-sm text-gray-600 ml-2">{uc.courses?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Current: {uc.grade || '-'}</span>
                      <select
                        value={gradeAdjustments[uc.id] ?? uc.grade ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value)
                          setGradeAdjustments(prev => ({ ...prev, [uc.id]: val }))
                        }}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="">-</option>
                        <option value="5">5</option>
                        <option value="4">4</option>
                        <option value="3">3</option>
                        <option value="2">2</option>
                        <option value="1">1</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingGradeModal(false)
                    setGradeAdjustments({})
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  onClick={() => setEditingGradeModal(false)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DegreePlanner
