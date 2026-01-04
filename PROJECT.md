# Homework Grader (MVP)

## What this project is

A web-based MVP that allows an instructor/TA to automatically grade a student's homework submission (image/PDF) using Gemini.

The grading is rubric-based and produces structured, explainable feedback.

## Primary user

Teaching assistants / instructors who need consistent grading at scale.

## MVP user flow (high level)

1. User provides:

   - Question / reference solution (text and/or file)

   - Student submission (image/PDF)

   - Notes / grading parameters (free text)

2. System creates a grading job.

3. A background worker processes the job with Gemini and stores a structured result.

4. The web UI polls job status and displays the result.

## Output contract (must remain stable)

The system must produce an `EvaluationResult` JSON object (validated by Zod) containing:

- score_total (0..100)

- criteria breakdown (per rubric item)

- flags (e.g. low confidence, missing pages)

- confidence (0..1)

- summary_feedback (string)

## Non-goals (for now)

- Authentication, courses, LMS integrations (Moodle/Canvas)

- Advanced plagiarism detection

- Automatic multi-question segmentation

- On-prem / enterprise compliance features

