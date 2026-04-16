# מדיניות עבודה על קוד — HomeWork Grader

## 1. מבנה הפרויקט

```
HomeWork/
├── apps/
│   ├── web/          # Next.js 14 — ממשק משתמש
│   └── worker/       # Background worker — עיבוד בדיקות עם Gemini AI
├── packages/
│   ├── shared-schemas/      # סכמות Zod משותפות
│   ├── local-course-store/  # ניהול קורסים מקומי
│   ├── local-job-store/     # ניהול עבודות בדיקה מקומי
│   └── firebase/            # Firebase client + admin wrappers
└── docs/             # מסמכי פרויקט
```

## 2. סביבת עבודה

| כלי | גרסה / פירוט |
|------|-------------|
| Package Manager | pnpm (monorepo workspaces) |
| Node.js | >= 20 |
| TypeScript | 5.x (strict mode) |
| Framework (web) | Next.js 14, React 18, Tailwind CSS 4 |
| AI Engine | Google Gemini API |
| Auth & DB | Firebase (Auth + Firestore) |
| Validation | Zod |
| i18n | next-intl |

## 3. כללי עבודה על קוד

### 3.1 סגנון קוד
- **TypeScript** בלבד — אין קבצי `.js` חדשים.
- **Strict mode** מופעל — אין `any` אלא אם יש סיבה מתועדת.
- שמות משתנים ופונקציות באנגלית, ב-camelCase.
- שמות קומפוננטות ב-PascalCase.
- שמות קבצי קומפוננטות ב-PascalCase (לדוגמה: `CoursesTable.tsx`).
- קבצי utility ו-lib ב-camelCase (לדוגמה: `geminiService.ts`).

### 3.2 ארגון קוד
- **קומפוננטות UI בסיסיות** → `src/components/ui/`
- **קומפוננטות פיצ׳ר** → `src/components/{feature}/` (לדוגמה: `courses/`, `review/`)
- **Layout** → `src/components/layout/`
- **לוגיקת ליבה של ה-worker** → `apps/worker/src/core/`
- **סכמות משותפות** → `packages/shared-schemas/`
- כל טיפוס/סכמה שמשמש יותר מאפליקציה אחת חייב להיות ב-`shared-schemas`.

### 3.3 עקרונות כלליים
- **DRY** — אל תשכפל קוד. אם משהו חוזר 3 פעמים, עשה ממנו פונקציה/קומפוננטה.
- **KISS** — פשטות קודמת לאלגנטיות. אל תבנה אבסטרקציה לפני שיש צורך אמיתי.
- **Small PRs** — PRs קטנים וממוקדים. עדיף 3 PRs קטנים מ-PR אחד ענקי.
- **תיעוד** — פונקציות מורכבות מקבלות הערה קצרה. אין צורך לתעד דברים ברורים מעצמם.

## 4. תהליך עבודה יומי

1. **לפני שמתחילים:** `git pull origin master` + בדיקה שאין קונפליקטים.
2. **פתיחת branch** לכל משימה (ראו מדיניות Git).
3. **עבודה + commits** קטנים ותכופים עם הודעות ברורות.
4. **בדיקה מקומית:** `pnpm dev:web` / `pnpm dev:worker` — לוודא שהכל עובד.
5. **פתיחת PR** + הוספת תיאור קצר של השינוי.
6. **Code Review** — השותף בודק ומאשר לפני merge.

## 5. תקשורת סביב קוד

- **לפני שינוי ארכיטקטוני:** יש לדבר עם השותף ולהגיע להסכמה.
- **שאלות טכניות:** לשאול ב-chat, לא להתקע לבד.
- **קונפליקטים ב-merge:** מי שגרם לקונפליקט אחראי לפתור אותו.
- **שבירת build:** מי ששבר מתקן מיד. זו עדיפות עליונה.

## 6. Environment ואבטחה

- **אין מפתחות / secrets בקוד.** הכל דרך `.env` (ראו `.env.example`).
- קובץ `.env` **לעולם לא** נכנס ל-Git.
- Firebase keys ציבוריים (`NEXT_PUBLIC_*`) מותרים בקוד צד-לקוח.
- Firebase Admin keys — צד שרת בלבד.
- Gemini API key — צד שרת (worker) בלבד.

## 7. Dependencies

- הוספת dependency חדש דורשת הסבר קצר למה הוא נחוץ.
- עדיפות לספריות מבוססות ומתוחזקות.
- עדכון dependencies ייעשה בתיאום בין השותפים.
- `pnpm-lock.yaml` תמיד נכנס ל-commit.
