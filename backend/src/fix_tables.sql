-- Drop existing tables and recreate with proper RLS
DROP TABLE IF EXISTS user_courses CASCADE;
DROP TABLE IF EXISTS course_realizations CASCADE;

-- User courses table (simplified version)
CREATE TABLE IF NOT EXISTS user_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'current', 'planned')),
  grade INTEGER,
  period TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for upsert
ALTER TABLE user_courses ADD CONSTRAINT user_courses_unique UNIQUE (user_id, course_id);

-- Enable RLS
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public read user_courses" ON user_courses;
DROP POLICY IF EXISTS "Public insert user_courses" ON user_courses;
DROP POLICY IF EXISTS "Public update user_courses" ON user_courses;
DROP POLICY IF EXISTS "Public delete user_courses" ON user_courses;

CREATE POLICY "Public read user_courses" ON user_courses FOR SELECT USING (true);
CREATE POLICY "Public insert user_courses" ON user_courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update user_courses" ON user_courses FOR UPDATE USING (true);
CREATE POLICY "Public delete user_courses" ON user_courses FOR DELETE USING (true);

-- Course realizations table for detailed course info
CREATE TABLE IF NOT EXISTS course_realizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  teaching_language TEXT,
  grading_scale TEXT,
  course_level TEXT,
  organizer_department TEXT,
  organizer_school TEXT,
  learning_outcomes TEXT,
  content TEXT,
  prerequisites TEXT,
  teaching_period TEXT,
  enrollment_info TEXT,
  study_methods TEXT,
  assessment_methods TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id)
);

ALTER TABLE course_realizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read course_realizations" ON course_realizations;
DROP POLICY IF EXISTS "Public insert course_realizations" ON course_realizations;
DROP POLICY IF EXISTS "Public update course_realizations" ON course_realizations;

CREATE POLICY "Public read course_realizations" ON course_realizations FOR SELECT USING (true);
CREATE POLICY "Public insert course_realizations" ON course_realizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update course_realizations" ON course_realizations FOR UPDATE USING (true);
