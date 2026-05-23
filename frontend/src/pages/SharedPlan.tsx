import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'

type Course = {
  code: string
  name: string
  credits: number
  status: string
  grade: number | null
  period: string | null
}

type ShareData = {
  name: string
  completedCredits: number
  gpa: number | null
  courses: Course[]
  sharedAt: string
}

const SharedPlan = () => {
  const { token } = useParams()
  const [data, setData] = useState<ShareData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: row, error: err } = await supabase
        .from('shared_plans')
        .select('payload, created_at')
        .eq('token', token)
        .single()
      if (err || !row) { setError(true); return }
      setData({ ...row.payload, sharedAt: row.created_at })
    }
    load()
  }, [token])

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">This plan link is invalid or has expired.</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm">Go to home</Link>
      </div>
    </div>
  )

  if (!data) return <div className="p-8 text-center text-gray-400">Loading...</div>

  const completed = data.courses.filter(c => c.status === 'completed')
  const planned = data.courses.filter(c => c.status === 'planned')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-blue-600 text-sm mb-6 block">← supersisu</Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{data.name}'s Degree Plan</h1>
              <p className="text-xs text-gray-400 mt-1">Shared {new Date(data.sharedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Read-only</span>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{data.completedCredits}</div>
              <div className="text-xs text-gray-500">Credits earned</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{data.gpa != null ? data.gpa.toFixed(2) : '—'}</div>
              <div className="text-xs text-gray-500">GPA</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-purple-600">{completed.length}</div>
              <div className="text-xs text-gray-500">Courses done</div>
            </div>
          </div>
        </div>

        {completed.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Completed ({completed.length})</h2>
            <div className="space-y-2">
              {completed.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                  <div>
                    <span className="font-mono text-xs text-green-700 mr-2">{c.code}</span>
                    <span className="text-gray-700">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{c.credits} cr</span>
                    {c.grade != null && <span className="font-bold text-green-600">{c.grade}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {planned.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Planned ({planned.length})</h2>
            <div className="space-y-2">
              {planned.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 bg-purple-50 rounded text-sm">
                  <div>
                    <span className="font-mono text-xs text-purple-700 mr-2">{c.code}</span>
                    <span className="text-gray-700">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{c.credits} cr</span>
                    {c.period && <span className="text-xs text-gray-400">{c.period}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500 mb-2">Want to track your own degree?</p>
          <Link to="/" className="text-sm bg-[#0065BD] text-white px-4 py-2 rounded-lg hover:bg-[#0055a3]">
            Try supersisu →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SharedPlan
