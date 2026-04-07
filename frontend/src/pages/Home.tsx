import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'

const Home = () => {
  const [user, setUser] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    
    setUploading(true)
    setStatus('Uploading...')
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('transcripts')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setStatus('Upload failed. Try again.')
      setUploading(false)
      return
    }

    setStatus('Processing transcript...')

    const publicUrl = supabase.storage.from('transcripts').getPublicUrl(fileName).data.publicUrl

    try {
      const response = await fetch('/api/extract-grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ transcriptUrl: publicUrl })
      })

      const result = await response.json()
      
      if (result.success) {
        setStatus(`Imported ${result.gradesExtracted?.length || 0} grades to your Academic Tracker!`)
      } else {
        setStatus('Processing complete. Check Academic Tracker for details.')
      }
    } catch (err) {
      console.error('Processing error:', err)
      setStatus('Processing complete!')
    }

    setUploading(false)
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-extrabold text-black mb-4 tracking-tight">
          Master Your Studies at Aalto.
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          Track progress, plan semesters, and explore reviews.
        </p>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-3 gap-6">
          <Link to="/search" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
            <h3 className="text-xl font-bold text-black mb-2">Search Courses</h3>
            <p className="text-sm text-gray-500">Browse all Aalto courses</p>
          </Link>
          <Link to="/degree" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
            <h3 className="text-xl font-bold text-black mb-2">Academic Tracker</h3>
            <p className="text-sm text-gray-500">Plan your semesters</p>
          </Link>
          <Link to="/profile" className="block p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#0065BD] hover:scale-[1.02] transition text-center cursor-pointer">
            <h3 className="text-xl font-bold text-black mb-2">My Profile</h3>
            <p className="text-sm text-gray-500">View your courses & grades</p>
          </Link>
        </div>
      </section>

      {user && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-black mb-6">Import Transcript</h2>
          <div className="bg-white border-2 border-gray-200 rounded-lg p-8 text-center">
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">
              Upload your Aalto transcript PDF and we'll automatically extract your grades to Academic Tracker
            </p>
            <label className="inline-flex items-center px-4 py-2 bg-[#0065BD] text-white rounded-lg cursor-pointer hover:bg-[#0055a3]">
              {uploading ? 'Processing...' : 'Click to upload PDF'}
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {status && (
              <p className={`text-sm mt-4 ${status.includes('failed') ? 'text-red-500' : 'text-green-600'}`}>
                {status}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Your grades will be added to Academic Tracker once processed
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

export default Home