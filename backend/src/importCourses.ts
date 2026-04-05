import dotenv from 'dotenv'
dotenv.config()

import { createServiceClient } from './supabase'

const SISU_KEY = 'f34207eee6d276104b8ac01879a84ce1'
const supabase = createServiceClient()

const importCourses = async () => {
  console.log('Fetching courses from Sisu API...')

  const response = await fetch(
    'https://course.api.aalto.fi/api/sisu/v1/courseunits?USER_KEY=' + SISU_KEY
  )

  const courses = await response.json()
  console.log('Total courses fetched:', courses.length)

  const formatted = courses
    .filter((c: any) => c.name && c.name.en && c.credits && c.credits.min > 0)
    .map((c: any) => ({
      code: c.code,
      name: c.name.en,
      credits: c.credits.min,
      language: 'English',
      period: null,
      major: null,
      teacher: null,
      avg_grade: null,
      description: null
    }))

  const seen = new Set()
  const deduplicated = formatted.filter((c: any) => {
    if (seen.has(c.code)) return false
    seen.add(c.code)
    return true
  })

  console.log('Courses after deduplication:', deduplicated.length)

  const chunkSize = 500
  for (let i = 0; i < deduplicated.length; i += chunkSize) {
    const chunk = deduplicated.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('courses')
      .upsert(chunk, { onConflict: 'code' })
    if (error) {
      console.error('Chunk error:', error.message)
    } else {
      console.log('Inserted chunk', i / chunkSize + 1)
    }
  }

  console.log('Import complete!')
}

importCourses()