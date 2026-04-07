-- Drop and recreate course_realizations table fresh
DROP TABLE IF EXISTS public.course_realizations CASCADE;

-- Create with explicit schema
CREATE TABLE public.course_realizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE UNIQUE,
  teaching_language text,
  grading_scale text,
  course_level text,
  organizer_department text,
  organizer_school text,
  learning_outcomes text,
  content text,
  prerequisites text,
  teaching_period text,
  enrollment_info text,
  study_methods text,
  assessment_methods text,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS for now (to test)
ALTER TABLE public.course_realizations DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.course_realizations TO anon;
GRANT ALL ON public.course_realizations TO authenticated;
GRANT ALL ON public.course_realizations TO service_role;
