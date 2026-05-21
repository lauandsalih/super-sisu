Role: You are a Senior Fullstack Engineer. You must follow these strict logic and constraints for the "Aalto Path" platform. Codex wil review your code once you're done.

1. Period & Year Alignment (The "Sisu-Sync" Fix)
The Bug: Currently, planning a course for Year YYYY Period X incorrectly maps it to YYYY+1 in the Timeline.
The Fix: Ensure absolute parity between the selection and the display. If a user selects 2026, the course must appear under the 2026 column in the Timeline. This applies to the Search results, Planned courses, and Completed courses.

2. Naming Conventions
Strict Rule: Replace all instances of P1, P2, P3, P4, P5 with Roman Numerals: I, II, III, IV, V.

3. Timeline X-Axis & Year Increments
The x-axis for both GPA and Credit graphs is based on "Rows" (Periods).
Starting Point: The first completion period starts at coordinates (0,0).
Year Labeling: The Year (e.g., 2025) must be displayed directly under the first period label.
Increment Logic: Every time the timeline encounters Period III, it signifies a new academic cycle. Increment the Year label by +1 specifically under the Period III that follows a previous year's Period I.

4. Multi-Period Planning & Visibility
Multi-Select: Users must be able to select multiple periods for a single course (e.g., a course running through Periods I and II).
Timeline Mirroring: If a course is planned for multiple periods, it must appear as a visible entry in every corresponding period column in the Timeline.
Inline Editing: Allow users to click/select a course directly in the Timeline to:
- Change its assigned period.
- Add it to an additional period without removing it from the current one.

5. Graph Tooltip Consistency
When hovering over the GPA or Credit graphs (Recharts), the "Hover Preview/Tooltip" data must be mathematically consistent with the specific data point (x, y) the mouse is currently touching. No offset or mismatched labeling.
After the first I in the x-axis, no other I should be labeled with a year.

6. Academic Index Calculation
Remove the academic Index altogether.

7. Privacy & Data Handling
PDF Transcripts: Must be processed in memory and immediately discarded after extraction. Never permanently stored in any storage bucket. User data must be reassurable with clear messaging about this.

8. Legacy Courses
Courses extracted from PDF that are not found in the official Aalto courses API should be marked as "legacy" (department = 'LEGACY'). Display a note to users explaining that legacy courses are those not found in the official catalog.

9. Graduation Date Persistence
The graduation date set by users in the Academic Tracker must persist in the database (users table, graduation_date field) and NOT revert or reset on page reload or session change.

10. GPA Display (Current vs Modified)
When showing GPA information, always display:
- Current GPA: The actual GPA based on grades entered in the system
- Modified GPA: The projected GPA if user has made what-if grade adjustments
Both values must be visible next to the Modify Grades button and near Academic Index

11. Academic Index Display
The Academic Index calculation must also show the current GPA and modified GPA (if applicable) alongside the index value for transparency.
Placement: GPA values must be displayed to the RIGHT of the Academic Index value, in the same row and with matching font styling.

12. Storage Bucket Policies
Broad SELECT policies on storage.objects must NOT be created or maintained. Each storage bucket must have restrictive policies:
- Only the file owner (authenticated user) can access their own files
- Or if files are temporary (e.g., PDF transcripts), policies can be removed entirely after implementing immediate deletion after processing

13. Navigation Page Order
Pages must be ordered: Academic Tracker → My Profile → Search Courses (left to right)


15. Course Page Format
Course page should display information in SISU-like format:
- Plan course. Clicking on this opens a modal to edit its periods. The course will be visible in planned courses and timeline.
- Learning outcomes
- Content
- Description
- Prerequisites
- Additional information (Teaching Language, Teaching Period)

16. Constraints Documentation
All new features, requirements, and decisions must be documented in constraints.md. Do not make significant changes without recording them there first.

17. Profile Course Add
Users can manually add courses to their profile (My Courses) via a modal with search, period, grade, and status selection.

18. Timeline Period Editing
Clicking on a planned course in the timeline AS WELL AS IN THE planned opens a modal to edit its periods.


19. Landing Page Auth
Add authentication section between subtitle and action cards:
- "Continue with Google" button (existing OAuth)
- Magic Link section with email input and "Send Magic Link" button
- Use Supabase signInWithMagicLink() for magic link login
- Show existing cards but visually secondary until authenticated

20. Credit Progress Line Styling
- Credit line should stop directly at the last completed period (no nulls beyond)
- Planned line should start from the endpoint of credit line and extend through planned periods

21. Pass/Fail Course Period Extraction
- PDF extraction extracts completionDate for pass/fail courses (grade = null). Remove status "Unknown" from the pass courses' completiondate.
- Backend converts completionDate to academic period (YYYY-YYYY X format) when saving to DB
- Frontend converts completionDate to academic period for dev mode/localStorage display
- Period mapping: Sep-Oct=Period I, Nov-Dec=Period II, Jan-Feb=Period III, Mar-May=Period IV, Jun-Jul=Period V, Aug=Summer 