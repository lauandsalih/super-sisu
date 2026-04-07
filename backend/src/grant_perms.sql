-- Force grant all permissions using service role
GRANT ALL ON public.course_realizations TO anon;
GRANT ALL ON public.course_realizations TO authenticated;
GRANT ALL ON public.course_realizations TO service_role;

-- Also for courses (to ensure joins work)
GRANT ALL ON public.courses TO anon;
GRANT ALL ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;

-- For user_courses
GRANT ALL ON public.user_courses TO anon;
GRANT ALL ON public.user_courses TO authenticated;
GRANT ALL ON public.user_courses TO service_role;
