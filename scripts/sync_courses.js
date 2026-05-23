// Syncs Aalto Open API courses into Supabase.
// Upserts new/updated courses, sets is_active=true for courses seen in API,
// marks courses not seen in this run as is_active=false.
// Never deletes — old courses are preserved as inactive.

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const AALTO_USER_KEY = process.env.AALTO_USER_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !AALTO_USER_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, AALTO_USER_KEY')
  process.exit(1)
}

const AALTO_API = 'https://course.api.aalto.fi/api/sisu/v1/courseunitrealisations'
const DEPT_MAP = buildDeptMap()

function buildDeptMap() {
  const prefixes = [
    ['MS', 'MS'], ['CS', 'CS'], ['ELEC', 'ELEC'], ['PHYS', 'PHYS'], ['CHEM', 'CHEM'],
    ['TU', 'TU'], ['KON', 'KON'], ['CIV', 'CIV'], ['MUO', 'MUO'], ['ARK', 'ARK'],
    ['BIZ', 'BIZ'], ['ECON', 'ECON'], ['FIN', 'FIN'], ['ISM', 'ISM'], ['MNGT', 'MGT'],
    ['MARK', 'MARK'], ['NBE', 'NBE'], ['ELO', 'ART'], ['ARTX', 'ART'], ['AXM', 'ART'],
    ['MEC', 'MEC'], ['ENG', 'ENG'], ['SCI', 'SCI'], ['LC', 'LC'], ['ABL', 'ABL'],
    ['AAE', 'AAE'], ['MAR', 'MAR'], ['WAT', 'WAT'], ['GIS', 'GIS'], ['SPT', 'SPT'],
    ['REC', 'REC'], ['KEY', 'KEY'], ['KIG', 'KIG'], ['JOIN', 'JOIN'], ['CIV', 'CIV'],
    ['RAK', 'RAK'], ['USP', 'USP'], ['PED', 'PED'], ['GEO', 'GEO'], ['ENE', 'ENE'],
    ['EKO', 'EKO'], ['COE', 'COE'], ['MLI', 'MLI'], ['SARK', 'SARK'], ['DICE', 'DICE'],
  ]
  return prefixes
}

function getDept(code) {
  if (!code) return 'OTHER'
  for (const [prefix, dept] of DEPT_MAP) {
    if (code.startsWith(prefix + '-') || code.startsWith(prefix + '_')) return dept
  }
  return 'OTHER'
}

function getLang(codes) {
  if (!codes || codes.length === 0) return null
  if (codes.includes('en')) return 'en'
  if (codes.includes('fi')) return 'fi'
  if (codes.includes('sv')) return 'sv'
  return codes[0]
}

async function supabaseRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`)
  }
  if (method === 'GET') return res.json()
  return null
}

async function fetchAllAaltoPages() {
  const courses = []
  let offset = 0
  const limit = 1000

  while (true) {
    const url = new URL(AALTO_API)
    url.searchParams.set('USER_KEY', AALTO_USER_KEY)
    url.searchParams.set('startTimeAfter', '2020-01-01')
    url.searchParams.set('limit', limit)
    url.searchParams.set('offset', offset)

    console.log(`Fetching Aalto API offset=${offset}...`)
    const res = await fetch(url.toString())
    if (!res.ok) {
      console.error(`Aalto API error: ${res.status}`)
      break
    }
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data.data || data.courseUnitRealisations || [])
    if (items.length === 0) break
    courses.push(...items)
    if (items.length < limit) break
    offset += limit
  }

  return courses
}

function transformCourse(item) {
  const nameObj = item.name || {}
  const name = nameObj.en || nameObj.fi || nameObj.sv || Object.values(nameObj)[0] || ''
  const code = item.code || ''
  const credits = item.credits?.min || item.credits?.max || item.credits || 0
  const lang = getLang(item.languageOfInstructionCodes || [])
  const dept = getDept(code)
  const teacher = Array.isArray(item.teachers)
    ? item.teachers.map(t => t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()).filter(Boolean).join(', ')
    : (item.teachers || '')
  const summary = item.summary || {}
  const prerequisites = summary.prerequisites?.en || summary.prerequisites?.fi || null
  const description = item.description?.en || item.description?.fi || null

  return {
    code,
    name,
    credits: typeof credits === 'number' ? credits : parseFloat(credits) || 0,
    language: lang,
    department: dept,
    teacher: teacher || null,
    description: description || null,
    prerequisites: prerequisites || null,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  }
}

async function main() {
  console.log('=== Aalto → Supabase course sync ===')

  // 1. Fetch from Aalto API
  const raw = await fetchAllAaltoPages()
  console.log(`Fetched ${raw.length} course realisations from Aalto API`)

  // Deduplicate by code — keep most recent (first seen wins, they're ordered by start date desc)
  const byCode = new Map()
  for (const item of raw) {
    const code = item.code
    if (code && !byCode.has(code)) {
      byCode.set(code, item)
    }
  }
  console.log(`Unique course codes: ${byCode.size}`)

  const activeCodes = new Set(byCode.keys())

  // 2. Transform
  const toUpsert = Array.from(byCode.values()).map(transformCourse).filter(c => c.code && c.name)

  // 3. Upsert in batches of 500
  const BATCH = 500
  let upserted = 0
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const batch = toUpsert.slice(i, i + BATCH)
    await supabaseRequest('POST', '/courses?on_conflict=code', batch)
    upserted += batch.length
    console.log(`Upserted ${upserted}/${toUpsert.length}...`)
  }

  // 4. Mark courses NOT in this API response as inactive
  // Fetch all codes currently in DB
  const dbCourses = await supabaseRequest('GET', '/courses?select=code&limit=10000')
  const inactiveCodes = (dbCourses || []).map(c => c.code).filter(c => c && !activeCodes.has(c))
  console.log(`Marking ${inactiveCodes.length} courses as inactive...`)

  // Batch update inactive in groups of 500
  for (let i = 0; i < inactiveCodes.length; i += BATCH) {
    const batch = inactiveCodes.slice(i, i + BATCH)
    const filter = batch.map(c => `"${c}"`).join(',')
    await supabaseRequest('PATCH', `/courses?code=in.(${encodeURIComponent(filter)})`, {
      is_active: false,
    })
  }

  console.log(`\n✓ Sync complete. Active: ${activeCodes.size} | Inactive: ${inactiveCodes.length}`)
}

main().catch(e => {
  console.error('Sync failed:', e)
  process.exit(1)
})
