-- Enable RLS and add policies for user_courses
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read user_courses" ON public.user_courses;
DROP POLICY IF EXISTS "Public insert user_courses" ON public.user_courses;
DROP POLICY IF EXISTS "Public update user_courses" ON public.user_courses;
DROP POLICY IF EXISTS "Public delete user_courses" ON public.user_courses;

CREATE POLICY "Public read user_courses" ON public.user_courses FOR SELECT USING (true);
CREATE POLICY "Public insert user_courses" ON public.user_courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update user_courses" ON public.user_courses FOR UPDATE USING (true);
CREATE POLICY "Public delete user_courses" ON public.user_courses FOR DELETE USING (true);

-- Enable RLS and add policies for course_realizations
ALTER TABLE public.course_realizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read course_realizations" ON public.course_realizations;
DROP POLICY IF EXISTS "Public insert course_realizations" ON public.course_realizations;
DROP POLICY IF EXISTS "Public update course_realizations" ON public.course_realizations;

CREATE POLICY "Public read course_realizations" ON public.course_realizations FOR SELECT USING (true);
CREATE POLICY "Public insert course_realizations" ON public.course_realizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update course_realizations" ON public.course_realizations FOR UPDATE USING (true);
