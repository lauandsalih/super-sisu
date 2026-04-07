-- Check if table has correct schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'course_realizations';

-- Check existing RLS policies
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'course_realizations';

-- Check if RLS is enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'course_realizations';
