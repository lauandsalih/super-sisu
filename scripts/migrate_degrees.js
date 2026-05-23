// One-time migration: creates user_degrees table, adds degree_id to user_courses,
// migrates existing rows to a default "Degree 1" per user.
// Safe to run multiple times — checks if migration already done.

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SQL error: ${text}`)
  }
  return res.json()
}

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  return res.json()
}

async function supabasePost(path, body, prefer = 'return=representation') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': prefer,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function supabasePatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PATCH ${path} failed: ${text}`)
  }
}

async function main() {
  console.log('=== Degree migration ===')

  // 1. Check if user_degrees table exists
  const existing = await supabaseGet('/user_degrees?limit=1')
  if (!Array.isArray(existing) && existing.code === '42P01') {
    console.log('user_degrees table does not exist — run SQL migration first')
    console.log(`
Run this in Supabase SQL Editor:

-- Create user_degrees table
CREATE TABLE IF NOT EXISTS user_degrees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Degree 1',
  target_credits int NOT NULL DEFAULT 180,
  graduation_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE user_degrees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own degrees" ON user_degrees
  FOR ALL USING (auth.uid() = user_id);

-- Add degree_id to user_courses
ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS degree_id uuid REFERENCES user_degrees(id) ON DELETE SET NULL;
    `)
    process.exit(1)
  }

  console.log('Tables exist, checking for unmigrated user_courses...')

  // 2. Find all distinct user_ids in user_courses that have no degree_id set
  const unmigrated = await supabaseGet('/user_courses?degree_id=is.null&select=user_id&limit=10000')
  if (!Array.isArray(unmigrated) || unmigrated.length === 0) {
    console.log('No unmigrated courses found — already done.')
    return
  }

  const userIds = [...new Set(unmigrated.map(r => r.user_id))]
  console.log(`Found ${unmigrated.length} unmigrated courses across ${userIds.length} users`)

  for (const userId of userIds) {
    // Check if this user already has a default degree
    const existingDegrees = await supabaseGet(`/user_degrees?user_id=eq.${userId}&limit=1`)
    let degreeId

    if (Array.isArray(existingDegrees) && existingDegrees.length > 0) {
      degreeId = existingDegrees[0].id
      console.log(`User ${userId}: using existing degree ${degreeId}`)
    } else {
      // Create default degree
      const created = await supabasePost('/user_degrees', {
        user_id: userId,
        name: 'Degree 1',
        target_credits: 180,
      })
      if (!Array.isArray(created) || !created[0]?.id) {
        console.error(`Failed to create degree for user ${userId}:`, created)
        continue
      }
      degreeId = created[0].id
      console.log(`User ${userId}: created default degree ${degreeId}`)
    }

    // Assign all their unmigrated courses to this degree
    await supabasePatch(`/user_courses?user_id=eq.${userId}&degree_id=is.null`, { degree_id: degreeId })
    console.log(`User ${userId}: migrated courses to degree ${degreeId}`)
  }

  console.log('✓ Migration complete')
}

main().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})
