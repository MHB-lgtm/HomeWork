# אפיון מערכת — HomeWork Grader

## 1. סקירה כללית

**HomeWork Grader** היא פלטפורמה מבוססת AI לבדיקת מבחנים ועבודות בית.
המערכת מאפשרת למרצים/מורים להעלות מבחנים, להגדיר רובריקות (קריטריונים לציון), ולקבל בדיקה אוטומטית של הגשות סטודנטים — כולל ציון מפורט, הצבעה על טעויות, והמלצות ללמידה.

## 2. קהל יעד

| משתמש | תפקיד |
|--------|-------|
| מרצה / מורה | מעלה מבחנים, מגדיר רובריקות, מנהל קורסים, צופה בתוצאות בדיקה |
| סטודנט | (עתידי) צפייה בציונים והערות |
| מנהל מערכת | (עתידי) ניהול משתמשים והרשאות |

## 3. ארכיטקטורה

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Web App       │────▶│   Firebase       │◀────│   Worker    │
│   (Next.js)     │     │   (Auth + DB)    │     │  (Node.js)  │
│                 │     │                  │     │             │
│  - UI/UX        │     │  - Authentication│     │  - Gemini   │
│  - PDF Viewer   │     │  - Firestore     │     │  - PDF      │
│  - i18n (he/en) │     │  - Storage       │     │  - Grading  │
└─────────────────┘     └──────────────────┘     └─────────────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │ Gemini AI   │
                                                 │ (Google)    │
                                                 └─────────────┘
```

### שכבות המערכת

| שכבה | טכנולוגיה | תפקיד |
|------|-----------|-------|
| Frontend | Next.js 14, React 18, Tailwind CSS 4 | ממשק משתמש, ניווט, הצגת נתונים |
| Auth | Firebase Authentication | הרשמה, התחברות, ניהול sessions |
| Database | Firebase Firestore | אחסון קורסים, מבחנים, עבודות בדיקה, תוצאות |
| Storage | Firebase Storage / Local FS | אחסון קבצי PDF (מבחנים והגשות) |
| Worker | Node.js + ts-node | עיבוד עבודות בדיקה ברקע |
| AI Engine | Google Gemini API | הערכת תשובות, זיהוי טעויות, המלצות |
| Validation | Zod (shared-schemas) | סכמות טיפוסים משותפות |
| i18n | next-intl | תמיכה בעברית ואנגלית |

## 4. מודולים ותכונות

### 4.1 ניהול קורסים (Courses)
- יצירת קורס חדש (שם, תיאור)
- צפייה ברשימת קורסים
- העלאת הרצאות/חומרי לימוד לקורס
- אינדוקס חומרים ל-RAG (Retrieval Augmented Generation)
- בדיקת RAG — שאילתות חיפוש על חומרי הקורס

**דפים:** `/courses`, `/courses/[courseId]`, `/my-courses`, `/my-courses/create`

### 4.2 ניהול מבחנים (Exams)
- העלאת מבחן (PDF)
- יצירת אינדקס שאלות מתוך המבחן (`generateExamIndex`)
- מיפוי שאלות לעמודים (`mapQuestionPages`)
- חילוץ עמודים רלוונטיים (`extractMiniPdf`)

**דף:** `/exams`

### 4.3 רובריקות (Rubrics)
- הגדרת קריטריונים לבדיקה (משקל, תיאור, ציון מקסימלי)
- תצוגת שורות קריטריון (`RubricCriterionRow`)

**דף:** `/rubrics`

### 4.4 בדיקת הגשות (Reviews / Grading)
זהו הליבה של המערכת — תהליך הבדיקה האוטומטית:

```
הגשת סטודנט (PDF)
        │
        ▼
   יצירת Job (pending)
        │
        ▼
   Worker מזהה Job חדש
        │
        ▼
   חילוץ PDF מינימלי לכל שאלה
        │
        ▼
   הערכה כללית של ההגשה (Gemini)
        │
        ▼
   הערכה מפורטת לכל שאלה (Gemini)
        │
        ▼
   לוקליזציה — מיפוי טעויות למיקום ב-PDF
        │
        ▼
   יצירת Study Pointers (המלצות ללמידה)
        │
        ▼
   שמירת תוצאות ← הצגה ב-UI
```

**תת-מודולים:**
| מודול | קובץ | תפקיד |
|-------|------|--------|
| Grade Submission | `gradeSubmission.ts` | אורקסטרציה של כל תהליך הבדיקה |
| General Evaluate | `generalEvaluateSubmission.ts` | הערכה כוללת של ההגשה |
| Per-Question Evaluate | `generalEvaluatePerQuestion.ts` | הערכה מפורטת לכל שאלה |
| Localize Findings | `localizeFindings.ts` | מיפוי ממצאים למיקום ב-PDF |
| Localize Mistakes | `localizeMistakes.ts` | מיפוי טעויות ספציפיות |
| Study Pointers | `attachStudyPointers.ts` | יצירת המלצות ללמידה |
| Exam Index | `loadExamIndex.ts` | טעינת אינדקס שאלות |
| PDF Extract | `extractMiniPdf.ts` | חילוץ עמודים רלוונטיים מ-PDF |

**דפים:** `/reviews`, `/reviews/[jobId]`

### 4.5 צפייה בתוצאות (Review UI)
- הצגת PDF של ההגשה עם סימון טעויות (`PDFViewer`)
- פאנל Study Pointers — המלצות ללמידה
- Badge סטטוס לכל עבודה (pending / processing / done / error)

### 4.6 אימות משתמשים (Auth)
- הרשמה והתחברות דרך Firebase Auth
- הפרדה בין דפי auth לדפי אפליקציה
- Middleware לבדיקת הרשאות

**דפים:** `/login`, `/register`

### 4.7 בינלאומיות (i18n)
- תמיכה בעברית ואנגלית
- מתג שפה (`LocaleSwitcher`)
- קבצי תרגום: `apps/web/messages/`
- Routing מבוסס locale: `/[locale]/...`

## 5. מודל נתונים (ישויות מרכזיות)

```
Course
├── id: string
├── name: string
├── description: string
├── lectures: Lecture[]
└── ragIndex?: RagIndex

Exam
├── id: string
├── courseId: string
├── pdfPath: string
├── questionIndex: QuestionEntry[]
└── questionPageMap: Record<questionId, pages[]>

Rubric
├── id: string
├── examId: string
└── criteria: RubricCriterion[]

RubricCriterion
├── description: string
├── maxScore: number
└── weight: number

Job (Review/Grading Job)
├── id: string
├── examId: string
├── submissionPdfPath: string
├── status: "pending" | "processing" | "done" | "error"
├── generalEvaluation?: EvaluationResult
├── perQuestionResults?: QuestionResult[]
├── localizedFindings?: Finding[]
├── studyPointers?: StudyPointer[]
└── timestamps: { created, started?, completed? }
```

## 6. תהליכי Worker

ה-Worker רץ כתהליך רקע שסורק עבודות חדשות ומעבד אותן:

- **`processNextPendingJob`** — שולף את ה-Job הבא בתור.
- **`heartbeat`** — דופק שמאפשר לזהות workers תקועים.
- **`runLoop`** — לולאה אינסופית שמעבדת עבודות.
- **`runOnce`** — עיבוד עבודה בודדת (לפיתוח/בדיקות).

## 7. שירותים חיצוניים

| שירות | שימוש | סוג מפתח |
|--------|-------|----------|
| Firebase Auth | אימות משתמשים | Client (public) |
| Firebase Firestore | מסד נתונים | Client + Admin |
| Firebase Storage | אחסון קבצים | Client + Admin |
| Google Gemini API | הערכת AI | Server only |

## 8. תכונות עתידיות (Roadmap)

- [ ] דשבורד סטטיסטיקות למרצה
- [ ] ממשק סטודנט לצפייה בציונים
- [ ] בדיקה קבוצתית (batch grading)
- [ ] התראות (email/push) על סיום בדיקה
- [ ] ניהול הרשאות מתקדם (admin panel)
- [ ] אינטגרציה עם מערכות LMS (Moodle, Canvas)
- [ ] API חיצוני למפתחים
- [ ] תמיכה בשפות נוספות
