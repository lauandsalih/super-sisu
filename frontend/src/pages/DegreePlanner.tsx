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
  gpa: number
}

type ChartDataPoint = {
  label: string
  periodLabel: string
  year: number
  actualCredits: number
  actualVisible?: number | null
  actualExtension?: number
  idealCredits?: number
  ideal?: number
  plannedCredits: number
  plannedOnlyCredits?: number  // Per-period only
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
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [editingPeriodModal, setEditingPeriodModal] = useState(false)
  const [editingPeriodCourse, setEditingPeriodCourse] = useState<any>(null)
  const [editingPeriodRowId, setEditingPeriodRowId] = useState<string>('')
  const [editingGradeModal, setEditingGradeModal] = useState(false)
  const [gradeAdjustments, setGradeAdjustments] = useState<Record<string, number | null>>({})
  const [includePlanned, setIncludePlanned] = useState(false)
  const [editingGradDateModal, setEditingGradDateModal] = useState(false)

  const PLAN_PERIOD_OPTIONS = [
    '2023-2024 I', '2023-2024 II', '2023-2024 III', '2023-2024 IV', '2023-2024 V', '2023-2024 Summer',
    '2024-2025 I', '2024-2025 II', '2024-2025 III', '2024-2025 IV', '2024-2025 V', '2024-2025 Summer',
    '2025-2026 I', '2025-2026 II', '2025-2026 III', '2025-2026 IV', '2025-2026 V', '2025-2026 Summer',
    '2026-2027 I', '2026-2027 II', '2026-2027 III', '2026-2027 IV', '2026-2027 V', '2026-2027 Summer'
  ]

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const [coursesData, userData] = await Promise.all([
          supabase
            .from('user_courses')
            .select('*, courses(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('users')
            .select('graduation_date')
            .eq('id', user.id)
            .maybeSingle()
        ])

        if (coursesData.data) {
          const completed = coursesData.data.filter((uc: any) => uc.status === 'completed')
          const current = coursesData.data.filter((uc: any) => uc.status === 'current')
          const planned = coursesData.data.filter((uc: any) => uc.status === 'planned')
          setCompletedCourses(completed)
          setCurrentCourses(current)
          setPlannedCourses(planned)
        }
        
        if (userData.data?.graduation_date) {
          setGoalDate(userData.data.graduation_date)
        } else if (userData.data) {
          setGoalDate(userData.data.graduation_date || '')
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
    // Academic year periods - period 1,2 are in fall (year YYYY), periods 3,4,5 are in spring (year YYYY+1)
    // P1 (Fall): September -> month 9
    // P2 (Fall): November -> month 11
    // P3 (Spring): January (year+1) -> month 1
    // P4 (Spring): March (year+1) -> month 3
    // P5 (Spring): May (year+1) -> month 5
    // Summer: July -> month 7
    const periodEndMonths: Record<number, number> = {
      1: 9,   // P1 ends in October (month 9 + 1)
      2: 11,  // P2 ends in December (month 11 + 1)
      3: 1,   // P3 ends in February (month 1 + 1)
      4: 3,   // P4 ends in April (month 3 + 1)
      5: 5,   // P5 ends in June (month 5 + 1)
      0: 7    // Summer ends in August (month 7 + 1)
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

  const romanToNum: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 }

  // Parse period string to semester data
  const parsePeriod = (periodStr: string | null): { year: number; period: number; name: string } | null => {
    if (!periodStr) return null
    const trimmed = periodStr.trim()
    
    // Try "YYYY-YYYY+1 I" format (academic year): "2023-2024 I"
    let match = trimmed.match(/^(\d{4})-(\d{4})\s+([IV]+|Summer)$/i)
    if (match) {
      const year = parseInt(match[1])
      const pStr = match[3].toUpperCase()
      const periodNum = pStr === 'SUMMER' ? 0 : romanToNum[pStr]
      if (!periodNum) return null
      const semesterName = periodNum === 0 ? `${match[1]}-${match[2]} Summer` : `${match[1]}-${match[2]} ${toRoman(periodNum)}`
      return { year, period: periodNum, name: semesterName }
    }
    
    // Try "YYYY IV" / "YYYY Summer" format
    match = trimmed.match(/^(\d{4})\s+([IV]+|Summer)$/i)
    if (match) {
      const startYear = parseInt(match[1])
      const pStr = match[2].toUpperCase()
      const periodNum = pStr === 'SUMMER' ? 0 : romanToNum[pStr]
      if (!periodNum) return null
      const semesterName = periodNum === 0 ? `${startYear} Summer` : `${startYear} ${toRoman(periodNum)}`
      return { year: startYear, period: periodNum, name: semesterName }
    }
    
    // Try "YYYY-P#" format (legacy)
    match = trimmed.match(/^(\d{4})\s*-\s*([1-5])$/i)
    if (match) {
      const startYear = parseInt(match[1])
      const periodNum = parseInt(match[2])
      const semesterName = `${startYear} ${toRoman(periodNum)}`
      return { year: startYear, period: periodNum, name: semesterName }
    }
    
    // Try just number (like "4")
    const numMatch = trimmed.match(/^([1-5])$/)
    if (numMatch) {
      const periodNum = parseInt(numMatch[1])
      const currentYear = new Date().getFullYear()
      const semesterName = `${currentYear} ${toRoman(periodNum)}`
      return { year: currentYear, period: periodNum, name: semesterName }
    }
    
    return null
  }

  const parsePlannedPeriods = (periodStr: string | null): { year: number; period: number; name: string }[] => {
    if (!periodStr) return []
    const items = periodStr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const unique = Array.from(new Set(items))
    return unique
      .map((p) => parsePeriod(p))
      .filter((p): p is { year: number; period: number; name: string } => Boolean(p))
  }

  const serializePlannedPeriods = (periods: string[]): string => {
    const unique = Array.from(new Set(periods.map((p) => p.trim()).filter(Boolean)))
    unique.sort((a, b) => {
      const pa = parsePeriod(a)
      const pb = parsePeriod(b)
      if (!pa || !pb) return a.localeCompare(b)
      return getSortKey(pa.year, pa.period) - getSortKey(pb.year, pb.period)
    })
    return unique.join(', ')
  }

  const buildSemesterData = (): SemesterData[] => {
    // Find min year from all courses (completed first, then planned if needed)
    let minYear = new Date().getFullYear()
    for (const course of completedCourses) {
      const parsed = parsePeriod(course.period)
      if (parsed && parsed.year < minYear) {
        minYear = parsed.year
      }
    }
    
    // If no completed courses, try planned courses
    if (completedCourses.length === 0 && plannedCourses.length > 0) {
      minYear = new Date().getFullYear()
      for (const course of plannedCourses) {
        const parsedList = parsePlannedPeriods(course.period)
        if (parsedList.length > 0) {
          const firstParsed = parsedList[0]
          if (firstParsed.year < minYear) {
            minYear = firstParsed.year
          }
        }
      }
    } else if (completedCourses.length === 0) {
      minYear = new Date().getFullYear()
    }
    
    const getPeriodFromDate = (d: Date): { year: number; period: number } => {
      const year = d.getFullYear()
      const month = d.getMonth() + 1 // 1-12
      if (month >= 9 && month <= 10) return { year, period: 1 }
      if (month >= 11 && month <= 12) return { year, period: 2 }
      if (month >= 1 && month <= 2) return { year: year - 1, period: 3 }
      if (month >= 3 && month <= 4) return { year: year - 1, period: 4 }
      if (month >= 5 && month <= 6) return { year: year - 1, period: 5 }
      return { year, period: 0 } // Summer
    }

    // Calculate max year - based on goal date (clamped to today), planned courses, or defaults
    let maxYear: number
    let timelineEndKey: number | null = null

    if (goalDate) {
      const parsedGoal = new Date(goalDate)
      if (!isNaN(parsedGoal.getTime())) {
        const now = new Date()
        const effectiveEndDate = parsedGoal < now ? now : parsedGoal
        const endPeriod = getPeriodFromDate(effectiveEndDate)
        timelineEndKey = getSortKey(endPeriod.year, endPeriod.period)
        maxYear = endPeriod.year
      } else if (plannedCourses.length > 0) {
        maxYear = minYear
        for (const course of plannedCourses) {
          const parsedList = parsePlannedPeriods(course.period)
          if (parsedList.length > 0) {
            const lastParsed = parsedList[parsedList.length - 1]
            if (lastParsed.year > maxYear) maxYear = lastParsed.year
          }
        }
      } else {
        maxYear = minYear + 3
      }
    } else if (plannedCourses.length > 0) {
      // Find max year from planned courses (use last period, handle academic year format)
      maxYear = minYear
      for (const course of plannedCourses) {
        const parsedList = parsePlannedPeriods(course.period)
        if (parsedList.length > 0) {
          const lastParsed = parsedList[parsedList.length - 1]
          // For academic year "2023-2024", the period spans to 2024
          const endYear = lastParsed.period === 0 ? lastParsed.year : lastParsed.year + 1
          if (endYear > maxYear) maxYear = endYear
        }
      }
    } else {
      maxYear = minYear + 3
    }
    
    const allPeriods: { year: number; period: number; name: string }[] = []
    
    for (let year = minYear; year <= maxYear; year++) {
      for (let period = 1; period <= 5; period++) {
        let semName: string
        // I, II are Fall YYYY; III, IV, V are Spring YYYY+1
        if (period <= 2) {
          semName = `Fall ${year} (${toRoman(period)})`
        } else {
          semName = `Spring ${year + 1} (${toRoman(period)})`
        }
        // But use the actual year for the timeline key
        allPeriods.push({ year, period, name: semName })
      }
    }
    
    // Also add Summer
    for (let year = minYear; year <= maxYear; year++) {
      allPeriods.push({ year, period: 0, name: `Summer ${year}` })
    }
    
    // Sort all periods chronologically
    allPeriods.sort((a, b) => getSortKey(a.year, a.period) - getSortKey(b.year, b.period))

    // If goal date is set, clamp timeline end to max(goalDate, today) period.
    const boundedPeriods = timelineEndKey === null
      ? allPeriods
      : allPeriods.filter((p) => getSortKey(p.year, p.period) <= timelineEndKey!)
    
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
          gpa: 0
        }
      }
      semesterMap[key].completed += course.courses?.credits || 0
    }

    // Add planned credits to ALL periods (each period shows its own planned credits)
    for (const course of plannedCourses) {
      const parsedList = parsePlannedPeriods(course.period)
      const credits = course.courses?.credits || 0
      // Add credits to each period (for per-period display)
      for (const parsed of parsedList) {
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
            gpa: 0
          }
        }
        // Add to this period's planned (not cumulative)
        semesterMap[key].planned += credits
      }
    }

    // Merge bounded periods with semester map
    const sortedSemesters: SemesterData[] = boundedPeriods.map(p => {
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
        gpa: 0
      }
    })
    
    let cumulativeCredits = 0
    let cumulativePlannedCredits = 0
    
    sortedSemesters.forEach((sem) => {
      // Only count credits if period has ended - use completed only, not planned
      if (isPeriodEnded(sem.year, sem.period)) {
        cumulativeCredits += sem.completed
      }
      sem.cumulative = cumulativeCredits
      
      // Cumulative with planned extends along planned-course timeline.
      cumulativePlannedCredits += sem.planned
      sem.cumulativeWithPlanned = cumulativeCredits + cumulativePlannedCredits
    })
    
    // Build cumulative GPA timeline including:
    // - completed courses (with what-if grade overrides)
    // - planned courses that have a selected what-if grade
    let cumulativeGradePoints = 0
    let cumulativeGradedCredits = 0
    const gpaPointIndices: number[] = []

    sortedSemesters.forEach((sem, idx) => {
      const semCompleted = completedCourses.filter(c => {
        const p = parsePeriod(c.period)
        return p && p.year === sem.year && p.period === sem.period
      })

      for (const c of semCompleted) {
        const grade = gradeAdjustments[c.id] !== undefined ? gradeAdjustments[c.id] : c.grade
        if (grade !== null && grade !== undefined) {
          const credits = c.courses?.credits || 0
          cumulativeGradePoints += grade * credits
          cumulativeGradedCredits += credits
        }
      }

      const semPlanned = plannedCourses.filter(c => {
        const periods = parsePlannedPeriods(c.period)
        return periods.some((p) => p.year === sem.year && p.period === sem.period)
      })

      for (const c of semPlanned) {
        const plannedGrade = gradeAdjustments[c.id]
        if (plannedGrade !== null && plannedGrade !== undefined) {
          const credits = c.courses?.credits || 0
          cumulativeGradePoints += plannedGrade * credits
          cumulativeGradedCredits += credits
        }
      }

      sem.gpa = cumulativeGradedCredits > 0 ? cumulativeGradePoints / cumulativeGradedCredits : 0
      if (cumulativeGradedCredits > 0) gpaPointIndices.push(idx)
    })

    // Keep GPA line up to the last point that has graded credits, hide later points.
    const lastGpaIdx = gpaPointIndices.length > 0 ? gpaPointIndices[gpaPointIndices.length - 1] : -1
    sortedSemesters.forEach((sem, idx) => {
      if (idx > lastGpaIdx) sem.gpa = 0
    })

    return sortedSemesters
  }

  const semesterData = buildSemesterData()
  
  const buildChartData = (): ChartDataPoint[] => {
    // First pass: create basic data
    let lastGPA = 0
    let hasGradedCredits = false
    
    // Find currentPeriodIdx by checking if period has ended
    let currentPeriodIdx = 0
    for (let i = 0; i < semesterData.length; i++) {
      if (!isPeriodEnded(semesterData[i].year, semesterData[i].period)) {
        currentPeriodIdx = i - 1 >= 0 ? i - 1 : i
        break
      }
    }
    if (currentPeriodIdx < 0) currentPeriodIdx = 0
    
    const data = semesterData.map((sem, idx) => {
      const periodKey = sem.period === 0 ? 'S' : toRoman(sem.period)
      const label = `${sem.year}-${periodKey}`
      
      if (sem.gpa > 0 || hasGradedCredits) {
        lastGPA = sem.gpa > 0 ? sem.gpa : lastGPA
        hasGradedCredits = true
      }
      
      return {
        index: idx,
        label,
        periodLabel: periodKey,
        year: sem.year,
        actualCredits: sem.cumulative,
        plannedCredits: sem.cumulativeWithPlanned,
        plannedOnlyCredits: sem.planned,
        gpa: lastGPA,
        period: sem.period,
        isCurrentOrFuture: !isPeriodEnded(sem.year, sem.period)
      }
    })

    if (data.length === 0) return data

    // Create unified combinedData with idealCredits for every period
    // Find last period with completed credits to end the ideal line there
    const lastCompletedIdx = data.findLastIndex(d => d.actualCredits > 0)
    const idealEndIdx = lastCompletedIdx >= 0 ? lastCompletedIdx : data.length - 1
    
    const combinedData = data.map((d, idx) => ({
      ...d,
      // Ideal line: from 0 to targetCredits, ending at last completed period
      idealCredits: idealEndIdx > 0 ? Math.round((idx / idealEndIdx) * targetCredits) : 0,
      actualExtension: 0
    }))

    // Calculate actualExtension: 
    // Find first and last period with planned credits
    const firstPlannedIdx = combinedData.findIndex(d => d.plannedOnlyCredits && d.plannedOnlyCredits > 0)
    const lastPlannedIdx = combinedData.findLastIndex(d => d.plannedOnlyCredits && d.plannedOnlyCredits > 0)
    
    // Find period that is currently happening (hasn't ended yet) and stop actual line there
    // The actual progress shows up to current period (including it)
    const activePeriodIdx = combinedData.findIndex(d => d.isCurrentOrFuture)
    const lastCompletedIdxForActual = activePeriodIdx >= 0 ? activePeriodIdx - 1 : combinedData.length - 1
    
    // Set all actual values beyond last completed to null (stop the line at current period)
    for (let i = 0; i < combinedData.length; i++) {
      if (i > lastCompletedIdxForActual) {
        combinedData[i].actualCredits = null as any
      }
    }
    
    // If no planned, return as-is
    if (firstPlannedIdx === -1) {
      return combinedData
    }
    
    // Calculate extension values
    // Find the last actual credits value before planned starts
    let lastActualCreditsValue = 0
    for (let i = 0; i < firstPlannedIdx; i++) {
      if (combinedData[i].actualCredits != null) {
        lastActualCreditsValue = combinedData[i].actualCredits
      }
    }
    
    for (let i = 0; i < combinedData.length; i++) {
      if (i < firstPlannedIdx) {
        // Before first planned: no extension line
        combinedData[i].actualExtension = null as any
      } else if (i === firstPlannedIdx) {
        // First planned period: start from last actual credits value
        combinedData[i].actualExtension = lastActualCreditsValue
      } else if (i <= lastPlannedIdx) {
        // Between first and last planned: add cumulatively from the start value
        const startExtension = combinedData[firstPlannedIdx].actualExtension || lastActualCreditsValue
        let totalPlannedCredits = 0
        for (let j = firstPlannedIdx; j <= i; j++) {
          totalPlannedCredits += combinedData[j].plannedOnlyCredits || 0
        }
        combinedData[i].actualExtension = startExtension + totalPlannedCredits
      } else {
        // After last planned: stop the line (null)
        combinedData[i].actualExtension = null as any
      }
    }

    return combinedData
  }

  const chartData = buildChartData()
  
  // Find the index where planned line should START (first period with planned credits)
  let plannedStartIdx = chartData.findIndex(d => d.plannedOnlyCredits && d.plannedOnlyCredits > 0)
  // If no planned credits found, find first current/future period
  if (plannedStartIdx === -1) {
    plannedStartIdx = chartData.findIndex(d => d.isCurrentOrFuture)
  }
  // Find last completed period index
  let lastCompletedIdx = 0
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (!chartData[i].isCurrentOrFuture) {
      lastCompletedIdx = i
      break
    }
    lastCompletedIdx = i
  }
  // Current period is one index before where planned starts
  let currentPeriodIdx = plannedStartIdx >= 0 ? plannedStartIdx - 1 : lastCompletedIdx
  if (currentPeriodIdx < 0) currentPeriodIdx = 0
  
  const completedCredits = completedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
  const currentCredits = currentCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
  const plannedCredits = plannedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
  const remaining = Math.max(0, targetCredits - completedCredits - plannedCredits)
  const progress = ((completedCredits + plannedCredits) / targetCredits) * 100

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>
  }

  // Use chartData directly (already contains idealCredits)
  const computedDisplayData = chartData

  const projectedGradedCredits = [
    ...completedCourses,
    ...plannedCourses
  ].reduce((sum, uc) => {
    const grade = gradeAdjustments[uc.id] !== undefined ? gradeAdjustments[uc.id] : uc.grade
    if (grade !== null && grade !== undefined) {
      return sum + (uc.courses?.credits || 0)
    }
    return sum
  }, 0)

  const projectedGradePoints = [
    ...completedCourses,
    ...plannedCourses
  ].reduce((sum, uc) => {
    const grade = gradeAdjustments[uc.id] !== undefined ? gradeAdjustments[uc.id] : uc.grade
    if (grade !== null && grade !== undefined) {
      return sum + grade * (uc.courses?.credits || 0)
    }
    return sum
  }, 0)

  const projectedGPA = projectedGradedCredits > 0 ? projectedGradePoints / projectedGradedCredits : 0

  const updatePlannedCoursePeriods = async (plannedRowId: string, nextPeriods: string[]) => {
    const normalized = serializePlannedPeriods(nextPeriods)
    if (!normalized) return
    await supabase.from('user_courses').update({ period: normalized }).eq('id', plannedRowId)
    setPlannedCourses((prev) =>
      prev.map((p) => (p.id === plannedRowId ? { ...p, period: normalized } : p))
    )
  }

  // Group courses by semester for the timeline
  const getCoursesBySemester = (status: 'completed' | 'planned') => {
    const courses = status === 'completed' ? completedCourses : plannedCourses
    const grouped: Record<string, UserCourse[]> = {}
    
    for (const course of courses) {
      if (status === 'planned') {
        const periods = parsePlannedPeriods(course.period)
        for (const parsed of periods) {
          const key = `${parsed.year}-${parsed.period}`
          if (!grouped[key]) grouped[key] = []
          grouped[key].push({ ...course, id: `${course.id}__${key}`, period: `${parsed.year} P${parsed.period}` })
        }
      } else {
        const parsed = parsePeriod(course.period)
        if (!parsed) continue
        const key = `${parsed.year}-${parsed.period}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(course)
      }
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
    if (period === 0) return `${year}-${year + 1} Summer`
    // Academic year format: "2023-2024 I"
    return `${year}-${year + 1} ${toRoman(period)}`
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
            <div className="text-center border-l pl-4 flex items-center justify-center">
              <span className="text-gray-500 font-medium mr-1">Academic Index:</span>
              <span className="font-semibold text-black mr-3">
                {(() => {
                  const now = new Date()
                  const currentMonth = now.getMonth() + 1
                  const currentYear = now.getFullYear()
                  let currentPeriod = 0
                  if (currentMonth >= 9 && currentMonth <= 10) currentPeriod = 1
                  else if (currentMonth >= 11 && currentMonth <= 12) currentPeriod = 2
                  else if (currentMonth >= 1 && currentMonth <= 2) currentPeriod = 3
                  else if (currentMonth >= 3 && currentMonth <= 4) currentPeriod = 4
                  else if (currentMonth >= 5 && currentMonth <= 6) currentPeriod = 5
                  
                  const gradedCourses = completedCourses.filter((uc: any) => {
                    if (uc.grade == null || !uc.period) return false
                    const p = parsePeriod(uc.period)
                    if (!p || !p.year) return false
                    if (p.year === currentYear && p.period === currentPeriod) return false
                    if (p.year === currentYear - 1 && currentPeriod <= 2 && p.period > 2) return true
                    if (p.year === currentYear && p.period < currentPeriod && p.period > 2) return true
                    if (p.year < currentYear) return true
                    return false
                  })
                  const gradedCredits = gradedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
                  const gradePoints = gradedCourses.reduce((sum, uc) => sum + ((uc.grade || 0) * (uc.courses?.credits || 0)), 0)
                  const gpa = gradedCredits > 0 ? gradePoints / gradedCredits : 0
                  
                  const semesterSet = new Set<string>()
                  gradedCourses.forEach((uc: any) => {
                    const p = parsePeriod(uc.period)
                    if (p && p.year) {
                      semesterSet.add(`${p.year}-${p.period}`)
                    }
                  })
                  const semesters = semesterSet.size
                  const academicIndex = gradedCredits > 0 && semesters > 0 ? (gpa * gradedCredits) / semesters : 0
                  return academicIndex.toFixed(2)
                })()}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500 font-medium ml-3 mr-1">GPA:</span>
              <span className="font-semibold text-gray-700">
                {(() => {
                  const now = new Date()
                  const currentMonth = now.getMonth() + 1
                  const currentYear = now.getFullYear()
                  let currentPeriod = 0
                  if (currentMonth >= 9 && currentMonth <= 10) currentPeriod = 1
                  else if (currentMonth >= 11 && currentMonth <= 12) currentPeriod = 2
                  else if (currentMonth >= 1 && currentMonth <= 2) currentPeriod = 3
                  else if (currentMonth >= 3 && currentMonth <= 4) currentPeriod = 4
                  else if (currentMonth >= 5 && currentMonth <= 6) currentPeriod = 5
                  
                  const gradedCourses = completedCourses.filter((uc: any) => {
                    if (uc.grade == null || !uc.period) return false
                    const p = parsePeriod(uc.period)
                    if (!p || !p.year) return false
                    if (p.year === currentYear && p.period === currentPeriod) return false
                    if (p.year === currentYear - 1 && currentPeriod <= 2 && p.period > 2) return true
                    if (p.year === currentYear && p.period < currentPeriod && p.period > 2) return true
                    if (p.year < currentYear) return true
                    return false
                  })
                  const gradedCredits = gradedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
                  const gradePoints = gradedCourses.reduce((sum, uc) => sum + ((uc.grade || 0) * (uc.courses?.credits || 0)), 0)
                  const gpa = gradedCredits > 0 ? gradePoints / gradedCredits : 0
                  return gpa.toFixed(2)
                })()}
              </span>
              {Object.keys(gradeAdjustments).length > 0 && (
                <>
                  <span className="mx-1 text-blue-400">→</span>
                  <span className="font-semibold text-blue-600">{projectedGPA.toFixed(2)}</span>
                </>
              )}
              <div className="group relative ml-2">
                <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="hidden group-hover:block absolute z-50 right-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                  <p className="font-semibold mb-1">Academic Index Calculation</p>
                  <p className="mb-2">(Credits × GPA) ÷ Academic semesters</p>
                  <p className="text-gray-400 text-[10px]">Excludes current semester. Based on courses with grades entered before the deadline.</p>
                  <p className="mt-2 text-[10px] text-gray-400 border-t border-gray-700 pt-2">Note: For official applications, verify with your school's exchange coordinator as policies may vary.</p>
                </div>
              </div>
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
                onChange={(e) => {
                  setTargetCredits(Number(e.target.value))
                  // Trigger recalculation
                }}
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
              <button
                onClick={() => setEditingGradDateModal(true)}
                className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m8 4v10a2 2 0 01-2 2h-4m-4 0H8a2 2 0 01-2-2V7m4 4h8" />
                </svg>
                Modify
                {goalDate && <span className="ml-1">({new Date(goalDate).toLocaleDateString('fi-FI')})</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Grade Adjustments Quick Panel - Inline */}
        {Object.keys(gradeAdjustments).length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-green-800">What-if Grade Adjustments</h2>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-gray-600">Projected GPA: </span>
                  <span className="font-bold text-green-600 text-lg">{projectedGPA.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setGradeAdjustments({})}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(gradeAdjustments).map(([courseId, grade]) => {
                const course = [...completedCourses, ...plannedCourses].find(c => c.id === courseId)
                if (!course) return null
                return (
                  <div key={courseId} className="bg-white rounded-lg border border-green-200 p-2 text-sm">
                    <div className="font-mono text-xs text-green-700">{course.courses?.code}</div>
                    <div className="flex items-center justify-between">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={grade ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value)
                          setGradeAdjustments(prev => ({ ...prev, [courseId]: val }))
                        }}
                        className="w-12 text-sm border rounded px-1 py-0.5 text-center font-medium"
                        placeholder="-"
                      />
                      <button
                        onClick={() => {
                          const newAdjustments = { ...gradeAdjustments }
                          delete newAdjustments[courseId]
                          setGradeAdjustments(newAdjustments)
                        }}
                        className="text-gray-400 hover:text-red-500 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Graduation Date Modal */}
        {editingGradDateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Set Graduation Date</h2>
              <input
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="w-full text-sm border rounded px-3 py-2 mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingGradDateModal(false)}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) {
                        alert('Not logged in')
                        return
                      }
                      
                      // First check if user record exists
                      const { data: existing } = await supabase
                        .from('users')
                        .select('id')
                        .eq('id', user.id)
                        .maybeSingle()
                      
                      let error
                      if (existing) {
                        // Update existing record
                        const result = await supabase
                          .from('users')
                          .update({ graduation_date: goalDate || null })
                          .eq('id', user.id)
                        error = result.error
                      } else {
                        // Insert new record
                        const result = await supabase
                          .from('users')
                          .insert({ id: user.id, graduation_date: goalDate || null })
                        error = result.error
                      }
                      
                      if (error) {
                        alert('Error saving: ' + error.message)
                        console.error('Save error:', error)
                      } else {
                        setEditingGradDateModal(false)
                      }
                    } catch (e) {
                      console.error('Exception:', e)
                      alert('Error: ' + e)
                    }
                  }}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

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
                <LineChart data={computedDisplayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="label" 
                    type="category"
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const idx = payload.index as number
                      if (idx === undefined || !computedDisplayData[idx]) return null
                      const dataPoint = computedDisplayData[idx]
                      const periodLabel = dataPoint.periodLabel
                      const displayYear = dataPoint.year
                      
                      // X-Axis Label Logic:
                      // Period on TOP, Year BELOW
                      // Period I starts new academic year: "2023-2024"
                      const isPeriodI = periodLabel === 'I'
                      
                      let periodLabelDisplay = ''
                      let yearLabelDisplay = ''
                      
                      
                      if (isPeriodI) {
                        // Period I: "2023-2024" academic year
                        yearLabelDisplay = `${displayYear}-${displayYear + 1}`
                        periodLabelDisplay = 'I'
                      } else {
                        // Other periods: show period only, no year
                        periodLabelDisplay = periodLabel
                        yearLabelDisplay = ''
                      }
                      
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={0} textAnchor="middle" fill="#374151" fontSize={11}>
                            {periodLabelDisplay}
                          </text>
                          {yearLabelDisplay && (
                            <text x={0} y={14} dy={0} textAnchor="middle" fill="#9ca3af" fontSize={9}>
                              {yearLabelDisplay}
                            </text>
                          )}
                        </g>
                      )
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, targetCredits]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: any) => [`${value} credits`, '']}
                    labelFormatter={(_: any, payload: any) => {
                      const idx = payload?.[0]?.dataIndex
                      if (idx === undefined || !computedDisplayData[idx]) return ''
                      const dc = computedDisplayData[idx]
                      return `Period ${dc.periodLabel} (${dc.year})`
                    }}
                  />
                  <Legend />
                  <ReferenceLine y={targetCredits} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                  {currentPeriodIdx >= 0 && (
                    <ReferenceLine 
                      x={computedDisplayData[currentPeriodIdx]?.periodLabel} 
                      stroke="#9ca3af" 
                      strokeDasharray="3 3" 
                      strokeWidth={1}
                    />
                  )}
                  {currentPeriodIdx >= 0 && (
                    <ReferenceDot 
                      x={computedDisplayData[currentPeriodIdx]?.periodLabel} 
                      y={computedDisplayData[currentPeriodIdx]?.actualCredits} 
                      r={6} 
                      fill="#ef4444" 
                      stroke="white" 
                      strokeWidth={2} 
                    />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="actualCredits"
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Actual Progress"
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    strokeLinecap="round"
                    connectNulls={false}
                  />
                  {includePlanned && (
                    <Line
                      type="monotone"
                      dataKey="actualExtension"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                      name="Actual + Planned Extension"
                      dot={false}
                      connectNulls={true}
                    />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="idealCredits" 
                    stroke="#9ca3af" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Ideal"
                    dot={false}
                    connectNulls={true}
                  />
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
              <div className="flex items-center gap-4">
                {(() => {
                  const now = new Date()
                  const currentMonth = now.getMonth() + 1
                  const currentYear = now.getFullYear()
                  let currentPeriod = 0
                  if (currentMonth >= 9 && currentMonth <= 10) currentPeriod = 1
                  else if (currentMonth >= 11 && currentMonth <= 12) currentPeriod = 2
                  else if (currentMonth >= 1 && currentMonth <= 2) currentPeriod = 3
                  else if (currentMonth >= 3 && currentMonth <= 4) currentPeriod = 4
                  else if (currentMonth >= 5 && currentMonth <= 6) currentPeriod = 5
                  
                  const gradedCourses = completedCourses.filter((uc: any) => {
                    if (uc.grade == null || !uc.period) return false
                    const p = parsePeriod(uc.period)
                    if (!p || !p.year) return false
                    if (p.year === currentYear && p.period === currentPeriod) return false
                    if (p.year === currentYear - 1 && currentPeriod <= 2 && p.period > 2) return true
                    if (p.year === currentYear && p.period < currentPeriod && p.period > 2) return true
                    if (p.year < currentYear) return true
                    return false
                  })
                  const gradedCredits = gradedCourses.reduce((sum, uc) => sum + (uc.courses?.credits || 0), 0)
                  const gradePoints = gradedCourses.reduce((sum, uc) => sum + ((uc.grade || 0) * (uc.courses?.credits || 0)), 0)
                  const currentGPA = gradedCredits > 0 ? gradePoints / gradedCredits : 0
                  return currentGPA > 0 ? (
                    <>
                      <span className="text-sm text-gray-600">
                        Current GPA: <span className="font-bold text-gray-900">{currentGPA.toFixed(2)}</span>
                      </span>
                      {Object.keys(gradeAdjustments).length > 0 && (
                        <span className="text-sm text-blue-600">
                          → Modified: <span className="font-bold text-blue-600">{projectedGPA.toFixed(2)}</span>
                        </span>
                      )}
                    </>
                  ) : null
                })()}
                <button
                  onClick={() => setEditingGradeModal(true)}
                  className="text-xs bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Modify Grades
                </button>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={computedDisplayData.filter((d, i) => i <= currentPeriodIdx && d.gpa > 0)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis 
                    dataKey="label" 
                    type="category"
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const idx = payload.index as number
                      if (idx === undefined) return null
                      const gpaData = computedDisplayData.filter((_, i) => i <= currentPeriodIdx && computedDisplayData[i]?.gpa > 0)
                      if (!gpaData[idx]) return null
                      const dataPoint = gpaData[idx]
                      const periodLabel = dataPoint.periodLabel
                      const displayYear = dataPoint.year
                      
                      // X-Axis Label Logic:
                      // Period on TOP, Year BELOW
                      // Period I starts new academic year: "2023-2024"
                      const isPeriodI = periodLabel === 'I'
                      
                      let periodLabelDisplay = ''
                      let yearLabelDisplay = ''
                      
                      
                      if (isPeriodI) {
                        // Period I: "2023-2024" academic year
                        yearLabelDisplay = `${displayYear}-${displayYear + 1}`
                        periodLabelDisplay = 'I'
                      } else {
                        // Other periods: show period only, no year
                        periodLabelDisplay = periodLabel
                        yearLabelDisplay = ''
                      }
                      
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={0} textAnchor="middle" fill="#374151" fontSize={11}>
                            {periodLabelDisplay}
                          </text>
                          {yearLabelDisplay && (
                            <text x={0} y={14} dy={0} textAnchor="middle" fill="#9ca3af" fontSize={9}>
                              {yearLabelDisplay}
                            </text>
                          )}
                        </g>
                      )
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} domain={[1, 5]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    formatter={(value: any) => [`${Number(value).toFixed(2)} GPA`, 'Cumulative GPA']}
                    labelFormatter={(label: any, payload: any) => {
                      const idx = payload?.[0]?.dataIndex
                      if (idx === undefined || idx >= computedDisplayData.length) return String(label)
                      const dataPoint = computedDisplayData[idx]
                      const period = dataPoint?.periodLabel || ''
                      const year = dataPoint?.year || ''
                      return `Period ${period} (${year})`
                    }}
                  />
                  <ReferenceLine y={targetGPA} stroke="#22c55e" strokeDasharray="5 5" label={`Goal (${targetGPA})`} />
                  {currentPeriodIdx >= 0 && (
                    <ReferenceLine 
                      x={computedDisplayData[currentPeriodIdx]?.periodLabel} 
                      stroke="#9ca3af" 
                      strokeDasharray="3 3" 
                      strokeWidth={1}
                    />
                  )}
                  {currentPeriodIdx >= 0 && (
                    <ReferenceDot 
                      x={computedDisplayData[currentPeriodIdx]?.periodLabel} 
                      y={computedDisplayData[currentPeriodIdx]?.gpa || 0} 
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
                        {semPlanned.map(uc => {
                          const plannedRowId = uc.id.split('__')[0]
                          const plannedRow = plannedCourses.find((p) => p.id === plannedRowId)
                          return (
                            <div 
                              key={uc.id} 
                              className="text-xs p-1.5 bg-purple-100 border border-purple-300 rounded text-purple-800 cursor-pointer hover:bg-purple-200"
                              onClick={() => {
                                if (plannedRow) {
                                  setEditingPeriodCourse(plannedRow.courses)
                                  setEditingPeriodRowId(plannedRowId)
                                  const currentPeriods = parsePlannedPeriods(plannedRow.period).map((p) =>
                                    p.period === 0 ? `${p.year} Summer` : `${p.year} ${toRoman(p.period)}`
                                  )
                                  setSelectedPeriods(currentPeriods.length > 0 ? currentPeriods : ['2025 P1'])
                                  setEditingPeriodModal(true)
                                }
                              }}
                            >
                              <div className="font-medium">{uc.courses?.code}</div>
                              <div className="text-gray-600">{uc.courses?.credits}cr (planned)</div>
                            </div>
                          )
                        })}
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
                      {uc.period && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          {uc.period}
                        </span>
                      )}
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
                          .limit(100)
                        if (data) {
                          setSearchResults(data)
                        }
                      } else {
                        setSearchResults([])
                      }
                    }}
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-2 max-h-64 overflow-auto border rounded">
                      {searchResults.map(course => (
                        <div 
                          key={course.id} 
                          className="p-2 bg-purple-50 rounded cursor-pointer hover:bg-purple-100"
                          onClick={() => {
                            setSelectedCourse(course)
                            setSearchResults([])
                          }}
                        >
                          <div className="font-medium">{course.code}</div>
                          <div className="text-sm text-gray-600">{course.name}</div>
                          <div className="text-xs text-gray-500">{course.credits} credits</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedCourse && (
                    <div className="mt-2 p-2 bg-purple-50 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{selectedCourse.code}</div>
                          <div className="text-sm text-gray-600">{selectedCourse.name}</div>
                          <div className="text-xs text-gray-500">{selectedCourse.credits} credits</div>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedCourse(null)
                            setSearchResults([])
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Periods</label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-auto">
                    {PLAN_PERIOD_OPTIONS.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedPeriods.includes(p)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPeriods([...selectedPeriods, p])
                            } else {
                              setSelectedPeriods(selectedPeriods.filter(period => period !== p))
                            }
                          }}
                          className="rounded"
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{selectedPeriods.length} selected</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setAddCourseModal(false)
                    setSelectedCourse(null)
                    setSelectedPeriods(['2024-2025 I'])
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (selectedCourse && selectedPeriods.length > 0) {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (user) {
                        const { data: existingPlanned } = await supabase
                          .from('user_courses')
                          .select('id, period')
                          .eq('user_id', user.id)
                          .eq('course_id', selectedCourse.id)
                          .eq('status', 'planned')
                          .maybeSingle()

                        if (existingPlanned) {
                          const existingPeriods = parsePlannedPeriods(existingPlanned.period).map((p) =>
                            p.period === 0 ? `${p.year}-${p.year + 1} Summer` : `${p.year}-${p.year + 1} ${toRoman(p.period)}`
                          )
                          const merged = serializePlannedPeriods([...existingPeriods, ...selectedPeriods])
                          await supabase.from('user_courses').update({ period: merged }).eq('id', existingPlanned.id)
                        } else {
                          await supabase.from('user_courses').insert({
                            user_id: user.id,
                            course_id: selectedCourse.id,
                            status: 'planned',
                            period: serializePlannedPeriods(selectedPeriods),
                            grade: null
                          })
                        }
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
                    setSelectedPeriods(['2024-2025 I'])
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
              <div className="bg-blue-50 border border-blue-100 rounded p-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Projected GPA</span>
                  <span className="font-semibold text-blue-700">{projectedGPA.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-600">Graded credits (incl. planned)</span>
                  <span className="font-semibold text-blue-700">{projectedGradedCredits}</span>
                </div>
              </div>

              <h4 className="font-medium text-sm text-gray-700 mb-2">Completed Courses</h4>
              <div className="space-y-2 mb-5">
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

              <h4 className="font-medium text-sm text-purple-700 mb-2">Planned Courses</h4>
              <div className="space-y-2">
                {plannedCourses.map(uc => (
                  <div key={uc.id} className="flex items-center justify-between p-2 bg-purple-50 rounded">
                    <div>
                      <span className="font-mono text-sm">{uc.courses?.code}</span>
                      <span className="text-sm text-gray-600 ml-2">{uc.courses?.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({uc.courses?.credits || 0} cr)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Grade:</span>
                      <select
                        value={gradeAdjustments[uc.id] ?? ''}
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
                {plannedCourses.length === 0 && (
                  <p className="text-sm text-gray-400">No planned courses</p>
                )}
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

        {/* Edit Period Modal */}
        {editingPeriodModal && editingPeriodCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="font-semibold text-lg mb-4">Update Periods</h3>
              <div className="mb-4 p-3 bg-purple-50 rounded">
                <div className="font-medium">{editingPeriodCourse.code}</div>
                <div className="text-sm text-gray-600">{editingPeriodCourse.name}</div>
                <div className="text-xs text-gray-500">{editingPeriodCourse.credits} credits</div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">Periods</label>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-auto">
                  {PLAN_PERIOD_OPTIONS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedPeriods.includes(p)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPeriods([...selectedPeriods, p])
                          } else {
                            setSelectedPeriods(selectedPeriods.filter(period => period !== p))
                          }
                        }}
                        className="rounded"
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">{selectedPeriods.length} selected</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingPeriodModal(false)
                    setEditingPeriodCourse(null)
                    setEditingPeriodRowId('')
                    setSelectedPeriods(['2024-2025 I'])
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (editingPeriodRowId && selectedPeriods.length > 0) {
                      await updatePlannedCoursePeriods(editingPeriodRowId, selectedPeriods)
                      const { data } = await supabase
                        .from('user_courses')
                        .select('*, courses(*)')
                        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                        .eq('status', 'planned')
                      if (data) setPlannedCourses(data)
                    }
                    setEditingPeriodModal(false)
                    setEditingPeriodCourse(null)
                    setEditingPeriodRowId('')
                    setSelectedPeriods(['2024-2025 I'])
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Update
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
