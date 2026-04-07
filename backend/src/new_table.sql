-- Drop and recreate course_realizations with new name to avoid any hidden issues
DROP TABLE IF EXISTS public.course_realizations_new CASCADE;

CREATE TABLE public.course_realizations_new (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
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
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(course_id)
);

ALTER TABLE public.course_realizations_new ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read course_realizations_new" ON public.course_realizations_new FOR SELECT USING (true);
CREATE POLICY "Public insert course_realizations_new" ON public.course_realizations_new FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update course_realizations_new" ON public.course_realizations_new FOR UPDATE USING (true);
