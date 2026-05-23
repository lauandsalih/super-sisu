import { useState, useMemo } from 'react'

type CourseEntry = {
  id: number
  name: string
  credits: number
  grade: number | null
}

let nextId = 1

const GpaSimulator = () => {
  const [courses, setCourses] = useState<CourseEntry[]>([
    { id: nextId++, name: '', credits: 5, grade: null },
  ])
  const [currentGPA, setCurrentGPA] = useState<string>('')
  const [currentCredits, setCurrentCredits] = useState<string>('')

  const addCourse = () => setCourses(prev => [...prev, { id: nextId++, name: '', credits: 5, grade: null }])
  const removeCourse = (id: number) => setCourses(prev => prev.filter(c => c.id !== id))
  const updateCourse = (id: number, field: keyof CourseEntry, value: any) =>
    setCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))

  const result = useMemo(() => {
    const existingGPA = parseFloat(currentGPA)
    const existingCredits = parseFloat(currentCredits)
    const hasExisting = !isNaN(existingGPA) && !isNaN(existingCredits) && existingCredits > 0

    const gradedCourses = courses.filter(c => c.grade !== null && c.credits > 0)
    if (gradedCourses.length === 0 && !hasExisting) return null

    const newGradePoints = gradedCourses.reduce((sum, c) => sum + (c.grade! * c.credits), 0)
    const newCredits = gradedCourses.reduce((sum, c) => sum + c.credits, 0)

    const totalGradePoints = (hasExisting ? existingGPA * existingCredits : 0) + newGradePoints
    const totalCredits = (hasExisting ? existingCredits : 0) + newCredits

    if (totalCredits === 0) return null
    return { gpa: totalGradePoints / totalCredits, totalCredits }
  }, [courses, currentGPA, currentCredits])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <a href="/" className="text-blue-600 text-sm mb-6 block">← Back to home</a>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GPA Simulator</h1>
        <p className="text-gray-500 text-sm mb-8">See how your planned or hypothetical grades affect your overall GPA.</p>

        {/* Existing GPA baseline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Current baseline (optional)</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Current GPA</label>
              <input
                type="number"
                min="1" max="5" step="0.01"
                value={currentGPA}
                onChange={e => setCurrentGPA(e.target.value)}
                placeholder="e.g. 3.50"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Credits completed</label>
              <input
                type="number"
                min="0"
                value={currentCredits}
                onChange={e => setCurrentCredits(e.target.value)}
                placeholder="e.g. 95"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Course entries */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Courses to simulate</h2>
          <div className="space-y-2">
            {courses.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={c.name}
                  onChange={e => updateCourse(c.id, 'name', e.target.value)}
                  placeholder="Course name (optional)"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  type="number"
                  value={c.credits}
                  onChange={e => updateCourse(c.id, 'credits', parseInt(e.target.value) || 0)}
                  className="w-16 border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                  min="1" max="30"
                  title="Credits"
                />
                <span className="text-xs text-gray-400">cr</span>
                <select
                  value={c.grade ?? ''}
                  onChange={e => updateCourse(c.id, 'grade', e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-24 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Grade</option>
                  <option value="5">5 — Excellent</option>
                  <option value="4">4 — Very good</option>
                  <option value="3">3 — Good</option>
                  <option value="2">2 — Satisfactory</option>
                  <option value="1">1 — Passable</option>
                </select>
                {courses.length > 1 && (
                  <button onClick={() => removeCourse(c.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addCourse}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            + Add another course
          </button>
        </div>

        {/* Result */}
        {result ? (
          <div className="bg-white rounded-xl border-2 border-blue-200 p-6 text-center">
            <p className="text-sm text-gray-500 mb-1">Projected GPA</p>
            <p className="text-5xl font-bold text-blue-600 mb-2">{result.gpa.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{result.totalCredits} credits total</p>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${((result.gpa - 1) / 4) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
            Select grades above to see your projected GPA
          </div>
        )}
      </div>
    </div>
  )
}

export default GpaSimulator
