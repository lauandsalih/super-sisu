import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { createSupabaseClient } from './supabase'
import pdfParse from 'pdf-parse'

const supabase = createSupabaseClient()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/', async (req, res) => {
  const { data, error } = await supabase.from('courses').select('*')
  if (error) {
    res.json({ message: 'Supabase connected but no tables yet', error: error.message })
  } else {
    res.json({ message: 'Supabase connected successfully', data })
  }
})

app.post('/api/extract-grades', async (req, res) => {
  try {
    const { pdfUrl, userId, pdfBase64, fileName } = req.body
    console.log('Extract grades request:', { pdfUrl, userId, hasBase64: !!pdfBase64 })
    
    let pdfBuffer: Buffer
    
    if (pdfBase64) {
      // Direct base64 PDF (no storage needed)
      pdfBuffer = Buffer.from(pdfBase64, 'base64')
    } else if (pdfUrl && userId) {
      // URL-based PDF (requires storage)
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to fetch PDF' })
      }
      const arrayBuffer = await response.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)
    } else {
      return res.status(400).json({ error: 'Missing pdfUrl or pdfBase64 and userId' })
    }
    
    const pdfData = await pdfParse(pdfBuffer)
    const pdfText = pdfData.text
    
    const courses = extractCoursesFromText(pdfText)
    console.log('Extracted courses:', courses.length, JSON.stringify(courses))
    
    let imported = 0
    let legacy = 0
    let failed: string[] = []
    
    console.log('All courses found:', courses.map(c => c.courseCode))

    const validCourses = courses.filter(c => c.courseCode)
    const courseCodes = validCourses.map(c => c.courseCode)

    // Single query to fetch all matching courses at once
    const { data: catalogCourses } = await supabase
      .from('courses')
      .select('id, code')
      .in('code', courseCodes)

    const catalogMap = new Map((catalogCourses || []).map(c => [c.code, c.id]))

    // Find unmatched codes and try fuzzy match in one query
    const unmatched = validCourses.filter(c => !catalogMap.has(c.courseCode))
    if (unmatched.length > 0) {
      const cleanCodes = unmatched.map(c => c.courseCode.replace(/[.\s-]/g, '').toUpperCase())
      const orFilter = cleanCodes.map(code => `code.ilike.%${code}%`).join(',')
      const { data: fuzzyMatches } = await supabase
        .from('courses')
        .select('id, code')
        .or(orFilter)
      if (fuzzyMatches) {
        for (const fm of fuzzyMatches) {
          const match = unmatched.find(c => {
            const clean = c.courseCode.replace(/[.\s-]/g, '').toUpperCase()
            return fm.code.replace(/[.\s-]/g, '').toUpperCase().includes(clean) || clean.includes(fm.code.replace(/[.\s-]/g, '').toUpperCase())
          })
          if (match && !catalogMap.has(match.courseCode)) catalogMap.set(match.courseCode, fm.id)
        }
      }
    }

    // Create legacy courses for anything still unmatched
    const stillUnmatched = validCourses.filter(c => !catalogMap.has(c.courseCode))
    if (stillUnmatched.length > 0) {
      const { data: inserted } = await supabase
        .from('courses')
        .upsert(
          stillUnmatched.map(c => ({
            code: c.courseCode,
            name: `Legacy: ${c.courseCode}`,
            credits: c.credits || 5,
            language: 'Unknown',
            department: 'LEGACY'
          })),
          { onConflict: 'code' }
        )
        .select('id, code')
      if (inserted) {
        for (const row of inserted) catalogMap.set(row.code, row.id)
        legacy += inserted.length
      }
    }

    // Batch upsert all user_courses in one request
    const upsertRows = validCourses
      .filter(c => catalogMap.has(c.courseCode))
      .map(c => ({
        user_id: userId,
        course_id: catalogMap.get(c.courseCode)!,
        status: 'completed',
        grade: c.grade,
        period: mapDateToPeriod(c.completionDate || null)
      }))

    failed = validCourses.filter(c => !catalogMap.has(c.courseCode)).map(c => c.courseCode)

    if (upsertRows.length > 0) {
      const { error: batchError } = await supabase
        .from('user_courses')
        .upsert(upsertRows, { onConflict: 'user_id,course_id,status' })
      if (batchError) {
        console.error('Batch upsert error:', batchError)
      } else {
        imported = upsertRows.length
      }
    }
    
    console.log('Final response:', { imported, legacy, total: courses.length, allCourses: courses.map(c => ({ code: c.courseCode, grade: c.grade, date: c.completionDate, credits: c.credits })) })
    
    // Delete the uploaded PDF after extraction for privacy
    try {
      await supabase.storage.from('transcripts').remove([pdfUrl.split('/').pop()!])
      console.log('PDF deleted after extraction')
    } catch (deleteErr) {
      console.log('PDF cleanup warning:', deleteErr)
    }
    
    res.json({ success: true, imported, legacy, total: courses.length, failedCourses: failed, gradesExtracted: courses.map(c => ({ code: c.courseCode, grade: c.grade, date: c.completionDate, credits: c.credits })), note: legacy > 0 ? `${legacy} course(s) marked as legacy (not found in Aalto catalog)` : undefined })
  } catch (error) {
    console.error('Extract grades error:', error)
    res.status(500).json({ error: 'Failed to extract grades' })
  }
})

function extractCoursesFromText(text: string) {
  const courses: { courseCode: string; grade: number | null; credits: number; completionDate?: string }[] = []
  const addedCodes = new Set<string>()
  
  // Match: (CODE) ... X cr ... grade
  const codePattern = /\(([A-Z]{2,4}-[A-Z0-9]+\d*)\)/gi
  let codeMatch
  while ((codeMatch = codePattern.exec(text)) !== null) {
    const courseCode = codeMatch[1].toUpperCase()
    if (addedCodes.has(courseCode)) continue
    
    // Find the line containing this code
    const codeIndex = codeMatch.index
    const lineStart = text.lastIndexOf('\n', codeIndex) + 1
    const lineEnd = text.indexOf('\n', codeIndex)
    const line = text.substring(lineStart, lineEnd > 0 ? lineEnd : text.length)
    
    const lineTrimmed = line.trim()
    
    // Extract credits - try multiple patterns
    // "5 cr", "5cr", "10 cr", "4cr", "cr 5", "CR 5" etc.
    let credits = 0
    let creditsMatch = lineTrimmed.match(/(\d+)\s*cr/i)
    if (creditsMatch) {
      credits = parseInt(creditsMatch[1], 10)
    } else {
      creditsMatch = lineTrimmed.match(/cr\s+(\d+)/i)
      if (creditsMatch) credits = parseInt(creditsMatch[1], 10)
    }
    // Debug: uncomment to see each line
    // console.log('Line:', lineTrimmed, '| credits found:', credits)

    let grade: number | null = null
    let completionDate: string | null = null
    
    // Pattern: "X cr en 2 19 Feb 2026" - grade is number (e.g., "5 cr en 2 19 Feb 2026")
    let gradeMatch = lineTrimmed.match(/(\d+)\s*cr\s+([a-z]{2})\s+(\d+)\s+(\d+)\s+([A-Za-z]+)\s+(\d{4})/i)
    if (gradeMatch) {
      grade = parseInt(gradeMatch[3], 10)
      completionDate = gradeMatch[4] + ' ' + gradeMatch[5] + ' ' + gradeMatch[6]
    }

    // Pattern: "X cr en Pass 15 Feb 2026" - grade is "Pass" (e.g., "2 cr en Pass 15 Feb 2026")
    if (!gradeMatch || grade === null) {
      gradeMatch = lineTrimmed.match(/(\d+)\s*cr\s+([a-z]{2})\s+Pass\s+(\d+)\s+([A-Za-z]+)\s+(\d{4})/i)
      if (gradeMatch) {
        grade = null  // Pass = null in database
        completionDate = gradeMatch[3] + ' ' + gradeMatch[4] + ' ' + gradeMatch[5]
      }
    }

    // Fallback: Try to find any date with Pass
    if (!completionDate && lineTrimmed.toLowerCase().includes('pass')) {
      const passDateMatch = lineTrimmed.match(/Pass\s+(\d+)\s+([A-Za-z]+)\s+(\d{4})/i)
      if (passDateMatch) {
        grade = null
        completionDate = passDateMatch[1] + ' ' + passDateMatch[2] + ' ' + passDateMatch[3]
      }
    }
    
    // Pattern 2: "X cr [lang] [grade] [date]" - with spaces
    if (!gradeMatch) {
      gradeMatch = lineTrimmed.match(/(\d+)\s*cr\s+([a-z]{2})\s+(\d)\s+(\d+)\s+([A-Za-z]+\s+\d{4})/i)
      if (gradeMatch) {
        const gradeStr = gradeMatch[3]
        const parsed = parseInt(gradeStr, 10)
        grade = (!isNaN(parsed) && parsed >= 0 && parsed <= 5) ? parsed : null
        completionDate = gradeMatch[4] + ' ' + gradeMatch[5]
      }
    }
    
    // Pattern 3: Pass with spaces "2 cr en Pass 15 Feb 2026"
    if (!gradeMatch) {
      gradeMatch = lineTrimmed.match(/(\d+)\s*cr\s+([a-z]{2})\s+Pass\s+(\d+)\s+([A-Za-z]+\s+\d{4})/i)
      if (gradeMatch) {
        grade = null
        completionDate = gradeMatch[3] + ' ' + gradeMatch[4]
      }
    }
    
    // Pattern 4: Pass no spaces "2 cr enPass15 Feb 2026"
    if (!gradeMatch) {
      gradeMatch = lineTrimmed.match(/(\d+)\s*cr\s+([a-z]{2})Pass(\d+)\s+([A-Za-z]+\s+\d{4})/i)
      if (gradeMatch) {
        grade = null
        completionDate = gradeMatch[3] + ' ' + gradeMatch[4]
      }
    }

    // Pattern 5: Pass with month-day-year format "2 cr en Pass Feb 15, 2026" or "Feb 15 2026"
    if (!gradeMatch) {
      gradeMatch = lineTrimmed.match(/(\d+)\s*cr\s+([a-z]{2})\s+Pass\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i)
      if (gradeMatch) {
        grade = null
        completionDate = gradeMatch[4] + ' ' + gradeMatch[3] + ' ' + gradeMatch[5]
      }
    }

    // Pattern 6: Try to find any date after "Pass" as fallback
    if (!gradeMatch && lineTrimmed.toLowerCase().includes('pass')) {
      const passDateMatch = lineTrimmed.match(/Pass\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
      if (passDateMatch) {
        grade = null
        completionDate = passDateMatch[1] + ' ' + passDateMatch[2] + ' ' + passDateMatch[3]
      }
    }
    
    courses.push({ courseCode, grade, credits, completionDate: completionDate || undefined })
    addedCodes.add(courseCode)
  }
  
  console.log('Parsed courses:', courses)
  return courses
}

app.post('/api/test-extract', async (req, res) => {
  const { text } = req.body
  const courses = extractCoursesFromText(text || 'test')
  res.json({ courses })
})

// Degree Structure API
app.get('/api/degree-structure', async (req, res) => {
  try {
    const userId = req.query.userId as string
    
    const { data: nodes, error } = await supabase
      .from('degree_nodes')
      .select('*')
      .order('position')
    
    if (error) throw error
    
    let completedCourseIds = new Set<string>()
    if (userId) {
      const { data: userCourses } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', userId)
        .eq('status', 'completed')
      
      if (userCourses) {
        userCourses.forEach(uc => completedCourseIds.add(uc.course_id))
      }
    }
    
    const nodeMap = new Map()
    const rootNodes: any[] = []
    
    nodes?.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [], completedCredits: 0, totalCredits: 0 })
    })
    
    nodes?.forEach(node => {
      const nodeData = nodeMap.get(node.id)
      if (node.parent_id) {
        const parent = nodeMap.get(node.parent_id)
        if (parent) parent.children.push(nodeData)
      } else {
        rootNodes.push(nodeData)
      }
    })
    
    const calcProgress = (node: any): number => {
      if (node.type === 'course_ref' && node.raw?.course_id) {
        node.totalCredits = node.raw.credits || 0
        node.completedCredits = completedCourseIds.has(node.raw.course_id) ? node.totalCredits : 0
        return node.completedCredits
      }
      
      let completed = 0
      node.children.forEach((child: any) => {
        completed += calcProgress(child)
      })
      
      node.completedCredits = completed
      node.totalCredits = node.min_credits || node.children.reduce((s: number, c: any) => s + c.totalCredits, 0)
      return completed
    }
    
    rootNodes.forEach(node => calcProgress(node))
    res.json({ nodes: rootNodes, completedCourseIds: Array.from(completedCourseIds) })
  } catch (error) {
    console.error('Degree structure error:', error)
    res.status(500).json({ error: 'Failed to fetch degree structure' })
  }
})

app.post('/api/degree-nodes', async (req, res) => {
  try {
    const { type, label, parent_id, position, min_credits, raw } = req.body
    
    const { data, error } = await supabase
      .from('degree_nodes')
      .insert({
        type,
        label: typeof label === 'string' ? { en: label } : label,
        parent_id,
        position: position || 0,
        min_credits,
        raw
      })
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Create node error:', error)
    res.status(500).json({ error: 'Failed to create node' })
  }
})

// Parse Sisu Kori JSON and insert into degree_nodes
app.post('/api/parse-sisu-structure', async (req, res) => {
  try {
    const { data: sisuData } = req.body
    
    if (!Array.isArray(sisuData)) {
      return res.status(400).json({ error: 'Expected array of Sisu modules' })
    }
    
    // Filter out null entries
    const validModules = sisuData.filter((m: any) => m && m.id && m.name)
    
    console.log('Valid modules:', validModules.length)
    console.log('First module sample:', validModules[0])
    
    // Map to store Sisu ID -> Supabase UUID
    const idMap = new Map<string, string>()
    
    // First pass: create all nodes
    for (const module of validModules) {
      console.log('Processing module:', module.id, module.name?.en)
      
      const typeMap: Record<string, string> = {
        'DegreeProgramme': 'degree',
        'StudyModule': 'module', 
        'GroupingModule': 'group'
      }
      
      const type = typeMap[module.type] || 'group'
      const label = module.name?.en || module.name?.fi || 'Unnamed'
      
      // Handle both "credits" and "targetCredits" formats
      const minCredits = module.credits?.min ?? module.targetCredits?.min ?? null
      const maxCredits = module.credits?.max ?? module.targetCredits?.max ?? null
      
      console.log('Inserting:', { sisu_id: module.id, type, label, minCredits })
      
      // Extract rule info for later linking
      const raw = {
        sisu_id: module.id,
        rule: module.rule,
        code: module.code,
        groupId: module.groupId,
        curriculumPeriodIds: module.curriculumPeriodIds
      }
      
      const { data: inserted, error } = await supabase
        .from('degree_nodes')
        .upsert({
          sisu_id: module.id,
          type,
          label: { en: label },
          min_credits: minCredits,
          max_credits: maxCredits,
          raw
        }, { onConflict: 'sisu_id' })
        .select('id, sisu_id')
        .single()
      
      if (error) {
        console.error('Error inserting node:', module.id, error)
        continue
      }
      
      if (inserted) {
        idMap.set(module.id, inserted.id)
      }
    }
    
    console.log(`Inserted ${idMap.size} nodes, now linking parent-child...`)
    
    // Second pass: link parent-child relationships
    for (const module of validModules) {
      if (!module.rule || module.rule.type !== 'CompositeRule') continue
      
      const parentId = idMap.get(module.id)
      if (!parentId) continue
      
      // Extract child IDs from CompositeRule
      // The structure typically has rules like:
      // module.rule.subRuleElements or module.rule.ruleElements
      const childIds = extractChildIds(module.rule)
      
      for (const childSisuId of childIds) {
        const childId = idMap.get(childSisuId)
        if (childId && childId !== parentId) {
          await supabase
            .from('degree_nodes')
            .update({ parent_id: parentId })
            .eq('id', childId)
        }
      }
    }
    
    res.json({ 
      success: true, 
      inserted: idMap.size,
      message: `Imported ${idMap.size} degree structure nodes`
    })
  } catch (error) {
    console.error('Parse error:', error)
    res.status(500).json({ error: 'Failed to parse Sisu structure' })
  }
})

// Helper to extract child IDs from CompositeRule
function extractChildIds(rule: any): string[] {
  if (!rule) return []
  
  // Check various possible structures
  const possibleFields = [
    'subRuleElements',
    'ruleElements', 
    'elements',
    'childRules',
    'rules'
  ]
  
  for (const field of possibleFields) {
    if (rule[field] && Array.isArray(rule[field])) {
      return rule[field]
        .map((el: any) => el.id || el.localId || el.ruleId)
        .filter((id: string) => id)
    }
  }
  
  // Sometimes the rule itself contains the ID directly
  if (rule.localId) return [rule.localId]
  
  return []
}

// Fetch and parse structure from Sisu API
app.get('/api/fetch-sisu-structure/:programmeId', async (req, res) => {
  try {
    const { programmeId } = req.params
    const { year = '2024-2025' } = req.query
    
    const koriBaseUrl = 'https://sisu.tuni.fi/kori/api/modules'
    
    // Fetch all modules for the programme
    const response = await fetch(`${koriBaseUrl}?curriculumPeriodId=${programmeId}&year=${year}`, {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Kori API error: ${response.status}`)
    }
    
    const modules = await response.json()
    console.log(`Fetched ${modules.length} modules from Kori API`)
    
    // Process and insert into degree_nodes
    const validModules = modules.filter((m: any) => m && m.id && m.name)
    
    const idMap = new Map<string, string>()
    
    // First pass: create all nodes
    for (const module of validModules) {
      const typeMap: Record<string, string> = {
        'DegreeProgramme': 'degree',
        'StudyModule': 'module', 
        'GroupingModule': 'group'
      }
      
      const type = typeMap[module.type] || 'group'
      const label = module.name?.en || module.name?.fi || 'Unnamed'
      const minCredits = module.targetCredits?.min ?? module.credits?.min ?? null
      const maxCredits = module.targetCredits?.max ?? module.credits?.max ?? null
      
      const raw = {
        sisu_id: module.id,
        rule: module.rule,
        code: module.code,
        groupId: module.groupId,
        curriculumPeriodIds: module.curriculumPeriodIds,
        documentState: module.documentState
      }
      
      const { data: inserted, error } = await supabase
        .from('degree_nodes')
        .upsert({
          sisu_id: module.id,
          type,
          label: { en: label },
          min_credits: minCredits,
          max_credits: maxCredits,
          raw
        }, { onConflict: 'sisu_id' })
        .select('id, sisu_id')
        .single()
      
      if (error) {
        console.error('Error inserting node:', module.id, error)
        continue
      }
      
      if (inserted) {
        idMap.set(module.id, inserted.id)
      }
    }
    
    // Second pass: link parent-child via CompositeRule
    for (const module of validModules) {
      if (!module.rule || module.rule.type !== 'CompositeRule') continue
      
      const parentId = idMap.get(module.id)
      if (!parentId) continue
      
      const childIds = extractChildIds(module.rule)
      
      for (const childSisuId of childIds) {
        const childId = idMap.get(childSisuId)
        if (childId && childId !== parentId) {
          await supabase
            .from('degree_nodes')
            .update({ parent_id: parentId })
            .eq('id', childId)
        }
      }
    }
    
    res.json({ 
      success: true, 
      imported: idMap.size,
      message: `Imported ${idMap.size} degree structure nodes from Kori API`
    })
  } catch (error) {
    console.error('Fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch from Sisu' })
  }
})

// Fetch course units from Kori API and insert into courses table
app.get('/api/fetch-sisu-courses', async (req, res) => {
  try {
    const { university = 'aalto' } = req.query
    const apiKey = process.env.KORI_API_KEY
    
    // Different university APIs
    const uniConfigs: Record<string, string> = {
      'aalto': 'https://sisu.aalto.fi/kori/api/course-units',
      'tuni': 'https://sisu.tuni.fi/kori/api/course-units'
    }
    
    const apiUrl = uniConfigs[university as string] || uniConfigs.aalto
    
    // Fetch course units with API key
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey || ''
      }
    })
    
    if (!response.ok) {
      throw new Error(`Kori API error: ${response.status}`)
    }
    
    const data = await response.json()
    const courses = Array.isArray(data) ? data : data.content || []
    
    console.log(`Fetched ${courses.length} course units`)
    
    let imported = 0
    
    for (const course of courses) {
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('code', course.code)
        .single()
      
      if (existing) continue // Skip if already exists
      
      const { error } = await supabase
        .from('courses')
        .upsert({
          code: course.code,
          name: course.name?.en || course.name?.fi || course.name?.sv || 'Unknown',
          credits: course.credits || course.credits?.min || 5,
          language: course.languageOfInstructionCodes?.[0] || 'en',
          period: course.teachingPeriod?.fi || null,
          description: course.summary?.en || course.summary?.fi || null,
          department: course.organizationId || null,
          teacher: course.teacherInCharge?.fi || null
        }, { onConflict: 'code' })
      
      if (!error) imported++
    }
    
    res.json({ 
      success: true, 
      imported,
      total: courses.length,
      message: `Imported ${imported} new courses`
    })
  } catch (error) {
    console.error('Fetch courses error:', error)
    res.status(500).json({ error: 'Failed to fetch courses from Sisu' })
  }
})

// Fetch detailed course info from Kori API
app.get('/api/course-details/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params
    
    // First check if we have details in our database
    const { data: existingRealization } = await supabase
      .from('course_realizations')
      .select('*, courses(code, name)')
      .eq('course_id', courseId)
      .single()
    
    if (existingRealization) {
      return res.json({ success: true, course: existingRealization, source: 'database' })
    }
    
    // Try Kori API with different endpoints
    const apiKey = process.env.KORI_API_KEY
    
    // Try the course unit listing endpoint
    const url = `https://sisu.aalto.fi/kori/api/courseunitrealisations?course_unit_code=${courseId}`
    console.log('Trying Kori:', url)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': apiKey || ''
      }
    })
    
    console.log('Kori response:', response.status)
    
    if (!response.ok) {
      // Return empty course details instead of error
      return res.json({ 
        success: true, 
        course: { code: courseId }, 
        source: 'not_found',
        message: 'Course details not available'
      })
    }
    
    const text = await response.text()
    if (!text || text === '[]') {
      return res.json({ 
        success: true, 
        course: { code: courseId }, 
        source: 'not_found',
        message: 'Course not found in Sisu'
      })
    }
    
    const courses = JSON.parse(text)
    const course = Array.isArray(courses) ? courses[0] : courses
    
    res.json({ success: true, course, source: 'kori' })
  } catch (error: any) {
    console.error('Fetch course details error:', error)
    res.status(500).json({ error: 'Failed to fetch course details', details: error.message })
  }
})

// Proxy endpoint to bypass RLS issues - get user courses
app.get('/api/user-courses/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { data, error } = await supabase
      .from('user_courses')
      .select('*, courses(*)')
      .eq('user_id', userId)
    
    if (error) {
      console.error('Error fetching user courses:', error)
      return res.status(500).json({ error: error.message })
    }
    
    res.json({ data })
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Map completion date to academic period
// Aalto periods: 
// - Period 1: September to October
// - Period 2: October to December
// - Period 3: January to February
// - Period 4: February/March to April
// - Period 5: April to June
// Academic year starts in September
function mapDateToPeriod(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Unknown'
  
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  
  // Determine which period based on month
  let period: number
  let academicYear: number
  
  if (month >= 9 && month <= 10) {
    // September-October = Period 1
    period = 1
    academicYear = year
  } else if (month >= 11 && month <= 12) {
    // November-December = Period 2
    period = 2
    academicYear = year
  } else if (month >= 1 && month <= 2) {
    // January-February = Period 3
    period = 3
    academicYear = year - 1
  } else if (month >= 3 && month <= 4) {
    // March-April = Period 4
    period = 4
    academicYear = year - 1
  } else if (month >= 5 && month <= 6) {
    // May-June = Period 5
    period = 5
    academicYear = year - 1
  } else {
    // July-August = Summer (academic year YYYY-YYYY+1)
    return `${year - 1}-${year} Summer`
  }
  
  const romanMap: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' }
  const roman = romanMap[period] || period.toString()
  // Format as academic year: "2023-2024 I"
  return `${academicYear}-${academicYear + 1} ${roman}`
}

app.get('/api/user-progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    const { data, error } = await supabase
      .from('user_courses')
      .select('grade, period, courses(credits)')
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    if (error) {
      console.error('Error fetching progress:', error)
      return res.status(500).json({ error: error.message })
    }
    
    const periodStats: Record<string, { credits: number, totalGrade: number, count: number }> = {}
    
    for (const item of data || []) {
      const period = item.period || 'Unknown'
      const credits = (item.courses as any)?.credits || 0
      
      if (!periodStats[period]) {
        periodStats[period] = { credits: 0, totalGrade: 0, count: 0 }
      }
      
      periodStats[period].credits += credits
      periodStats[period].count += 1
      if (item.grade !== null) {
        periodStats[period].totalGrade += item.grade
      }
    }
    
    const result = Object.entries(periodStats).map(([period, stats]) => ({
      period,
      credits: stats.credits,
      avgGrade: stats.count > 0 ? Math.round((stats.totalGrade / stats.count) * 10) / 10 : 0,
      courses: stats.count
    })).sort((a, b) => a.period.localeCompare(b.period))
    
    let cumulative = 0
    const resultWithCumulative = result.map(r => {
      cumulative += r.credits
      return { ...r, cumulativeCredits: cumulative }
    })
    
    res.json({ progress: resultWithCumulative })
  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})