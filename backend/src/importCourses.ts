import dotenv from 'dotenv'
dotenv.config()

import { createServiceClient } from './supabase'

const SISU_KEY = 'f34207eee6d276104b8ac01879a84ce1'
const supabase = createServiceClient()

const DEPARTMENT_MAP: Record<string, string> = {
  'department of mathematics and systems analysis': 'MS',
  'department of computer science': 'CS',
  'department of electrical engineering': 'ELEC',
  'department of electronics and nanoengineering': 'ELEC',
  'department of applied physics': 'PHYS',
  'department of chemistry and materials science': 'CHEM',
  'department of chemical and metallurgical engineering': 'CHEM',
  'department of industrial engineering and management': 'TU',
  'department of mechanical engineering': 'KON',
  'department of civil engineering': 'CIV',
  'department of built environment': 'MAA',
  'department of design': 'MUO',
  'department of architecture': 'ARK',
  'school of arts, design and architecture': 'ARK',
  'department of accounting & business law': 'BIZ',
  'department of economics': 'ECON',
  'department of finance': 'FIN',
  'department of information and service management': 'ISM',
  'department of management studies': 'MGT',
  'department of marketing': 'MARK',
  'department of energy and mechanical engineering': 'ENE',
  'department of bioproducts and biosystems': 'BIO',
  'department of neuroscience and biomedical engineering': 'NBE',
  'department of art and media': 'ART',
  'department of film': 'FILM',
  'department of information and communications engineering': 'ICT',
  'school of science': 'SCI',
  'school of electrical engineering': 'ELEC',
  'school of chemical engineering': 'CHEM',
  'school of engineering': 'ENG',
  'school of business': 'BIZ',
  'language centre': 'LC',
  'aalto university': 'OTHER',
}

const getDepartment = (orgName: any): string | null => {
  if (!orgName) return null
  const name = (orgName.en || orgName.fi || '').toLowerCase()
  for (const [key, value] of Object.entries(DEPARTMENT_MAP)) {
    if (name.includes(key)) return value
  }
  return null
}

const stripHtml = (text: string | null): string | null => {
  if (!text) return null
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim() || null
}

const formatPrerequisites = (text: string | null): string | null => {
  if (!text) return null
  const stripped = stripHtml(text)
  if (!stripped) return null
  return stripped.replace(/([A-Z]+-[A-Z0-9]+)/g, (match) => {
    const cleanCode = match.replace(/X+$/, '')
    return `[${match}](/search?q=${cleanCode})`
  })
}

const buildDescription = (summary: any): string | null => {
  if (!summary) return null
  
  const parts: string[] = []
  
  const content = stripHtml(summary.content?.en || summary.content?.fi)
  if (content) parts.push(`Content: ${content}`)
  
  const learningOutcomes = stripHtml(summary.learningOutcomes?.en || summary.learningOutcomes?.fi)
  if (learningOutcomes) parts.push(`Learning outcomes: ${learningOutcomes}`)
  
  return parts.length > 0 ? parts.join('\n\n') : null
}

const importCourses = async () => {
  console.log('Fetching courses from Sisu API...')

  const response = await fetch(
    'https://course.api.aalto.fi/api/sisu/v1/courseunitrealisations?USER_KEY=' + SISU_KEY
  )

  const courses = await response.json()
  console.log('Total courses fetched:', courses.length)

  const seen = new Map()
  const deptCounts: Record<string, number> = {}
  
  for (const c of courses) {
    if (!c.code || !c.name?.en || !c.credits?.min) continue
    if (c.credits.min <= 0) continue
    if (seen.has(c.code)) continue
    
    const description = buildDescription(c.summary)
    const prerequisites = formatPrerequisites(c.summary?.prerequisites?.en || c.summary?.prerequisites?.fi)
    const teacher = c.summary?.teacherInCharge?.[0] || c.teachers?.[0] || null
    const language = c.summary?.languageOfInstruction?.en || c.summary?.languageOfInstruction?.fi || 'English'
    const department = getDepartment(c.organizationName)
    
    if (department) {
      deptCounts[department] = (deptCounts[department] || 0) + 1
    }
    
    seen.set(c.code, {
      code: c.code,
      name: c.name.en,
      credits: c.credits.min,
      language,
      period: null,
      major: null,
      teacher,
      avg_grade: null,
      description,
      prerequisites,
      department
    })
  }

  const deduplicated = Array.from(seen.values())
  console.log('Courses after deduplication:', deduplicated.length)
  console.log('Department distribution:', deptCounts)

  const withDescriptions = deduplicated.filter(c => c.description)
  console.log('Courses with descriptions:', withDescriptions.length)

  const withPrerequisites = deduplicated.filter(c => c.prerequisites)
  console.log('Courses with prerequisites:', withPrerequisites.length)

  const chunkSize = 500
  for (let i = 0; i < deduplicated.length; i += chunkSize) {
    const chunk = deduplicated.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('courses')
      .upsert(chunk, { onConflict: 'code' })
    if (error) {
      console.error('Chunk error:', error.message)
    } else {
      console.log('Inserted chunk', Math.floor(i / chunkSize) + 1)
    }
  }

  console.log('Import complete!')
}

importCourses()