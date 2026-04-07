-- User courses table
CREATE TABLE IF NOT EXISTS user_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES courses(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'current', 'planned')),
  grade INTEGER,
  period TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for upsert
ALTER TABLE user_courses ADD CONSTRAINT user_courses_unique UNIQUE (user_id, course_id);

-- Enable RLS
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read user_courses" ON user_courses FOR SELECT USING (true);
CREATE POLICY "Public insert user_courses" ON user_courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update user_courses" ON user_courses FOR UPDATE USING (true);
CREATE POLICY "Public delete user_courses" ON user_courses FOR DELETE USING (true);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  workload INTEGER CHECK (workload >= 0 AND workload <= 5),
  difficulty INTEGER CHECK (difficulty >= 0 AND difficulty <= 5),
  teaching_quality INTEGER CHECK (teaching_quality >= 0 AND teaching_quality <= 5),
  comment TEXT,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  grade INTEGER CHECK (grade >= 0 AND grade <= 5)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1'
);

-- Course tags junction table
CREATE TABLE IF NOT EXISTS course_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(course_id, tag_id)
);

-- Insert default tags
INSERT INTO tags (name, color) VALUES 
  ('Attendance Mandatory', '#ef4444'),
  ('No Final Exam', '#22c55e'),
  ('Group Work', '#3b82f6'),
  ('Easy Grading', '#10b981'),
  ('Challenging', '#f59e0b'),
  ('Good Lectures', '#8b5cf6'),
  ('Heavy Workload', '#ef4444'),
  ('Recommended', '#22c55e'),
  ('Use Stack Overflow', '#f97316'),
  ('Math Heavy', '#6366f1')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_tags ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Public insert reviews" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Public read course_tags" ON course_tags FOR SELECT USING (true);
CREATE POLICY "Public insert course_tags" ON course_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete course_tags" ON course_tags FOR DELETE USING (true);

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
CREATE POLICY "Public read course_realizations" ON course_realizations FOR SELECT USING (true);
CREATE POLICY "Public insert course_realizations" ON course_realizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update course_realizations" ON course_realizations FOR UPDATE USING (true);
