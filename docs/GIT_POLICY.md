# מדיניות Git — HomeWork Grader

## 1. Branches

### Branch ראשי
- **`master`** — branch יציב. קוד שנמצא כאן צריך לעבוד תמיד.
- **אסור לעשות push ישיר ל-master.** כל שינוי עובר דרך Pull Request.

### מבנה שמות Branches

```
<type>/<short-description>
```

| Type | שימוש | דוגמה |
|------|-------|-------|
| `feat/` | פיצ׳ר חדש | `feat/student-dashboard` |
| `fix/` | תיקון באג | `fix/pdf-viewer-crash` |
| `refactor/` | שיפור קוד ללא שינוי התנהגות | `refactor/grading-pipeline` |
| `ui/` | שינויי עיצוב / UI בלבד | `ui/dark-mode-toggle` |
| `chore/` | תחזוקה, dependencies, config | `chore/update-firebase-sdk` |
| `docs/` | תיעוד בלבד | `docs/api-readme` |
| `hotfix/` | תיקון דחוף ל-master | `hotfix/auth-token-expired` |

### כללים
- Branch אחד = משימה אחת.
- Branch שחי יותר מ-5 ימים צריך rebase מ-master.
- Branches שמורגו נמחקים.

## 2. Commits

### פורמט הודעת Commit

```
<type>(<scope>): <description>
```

**דוגמאות:**
```
feat(web): add course creation form
fix(worker): handle empty PDF in grading pipeline
refactor(schemas): split Job schema into sub-types
ui(review): improve PDF viewer zoom controls
chore(deps): bump next-intl to 4.8.3
```

### Types

| Type | משמעות |
|------|--------|
| `feat` | פיצ׳ר חדש |
| `fix` | תיקון באג |
| `refactor` | שינוי מבנה ללא שינוי התנהגות |
| `ui` | שינוי עיצובי / UI |
| `chore` | תחזוקה (dependencies, config, scripts) |
| `docs` | תיעוד |
| `test` | הוספה/שינוי של טסטים |

### Scopes מרכזיים

| Scope | מתייחס ל... |
|-------|------------|
| `web` | apps/web |
| `worker` | apps/worker |
| `schemas` | packages/shared-schemas |
| `firebase` | packages/firebase |
| `deps` | dependencies |
| `i18n` | תרגומים |

### כללים
- כל commit הוא יחידה לוגית אחת. אין "fix everything" commits.
- הודעות באנגלית, בזמן הווה (imperative mood): "add" לא "added".
- commit קטן ותכוף עדיף על commit גדול ונדיר.

## 3. Pull Requests

### תהליך
1. פתח branch מ-master.
2. עבוד, commit, push.
3. פתח PR ב-GitHub.
4. הוסף תיאור קצר: **מה** השתנה ו**למה**.
5. השותף עושה review.
6. תקן הערות אם יש.
7. Merge (Squash & Merge מועדף).
8. מחק את ה-branch.

### תבנית PR

```markdown
## מה השתנה
- [תיאור קצר של השינויים]

## למה
- [סיבה / context]

## בדיקות
- [ ] רץ מקומית ועובד
- [ ] לא שובר פיצ׳רים קיימים
```

### כללים
- PR קטן וממוקד (עד ~300 שורות שינוי מועדף).
- PR חייב review של השותף לפני merge.
- PR עם קונפליקטים — מי שפתח את ה-PR אחראי לפתור.
- לא עושים merge ל-PR שלא עובר build.

## 4. Code Review

### מה בודקים
- לוגיקה נכונה
- קריאות הקוד
- אין קוד מיותר / מת
- אין secrets בקוד
- עקביות עם שאר הקוד
- ביצועים — אין פעולות כבדות מיותרות

### אתיקה
- הערות ענייניות ומכבדות.
- שואלים "למה?" לפני שאומרים "שנה".
- אם זה עניין של טעם — מקבלים ועוברים הלאה.
- אישור תוך 24 שעות (עדיפות ל-PRs קטנים).

## 5. .gitignore

וודאו שהפריטים הבאים **לא** נכנסים ל-Git:

```
node_modules/
dist/
.env
.env.local
.next/
*.log
.DS_Store
```

## 6. מצבי חירום (Hotfix)

1. צור branch `hotfix/<description>` מ-master.
2. תקן את הבעיה.
3. פתח PR עם תיוג "HOTFIX" בכותרת.
4. ניתן לעשות merge עצמי אם השותף לא זמין — אבל חייבים ליידע.
5. עדכן את השותף מיד לאחר ה-merge.

## 7. סיכום — Do's and Don'ts

### Do's
- Pull לפני שמתחילים לעבוד
- Branch נפרד לכל משימה
- Commits קטנים ותכופים
- Review לפני merge
- מחיקת branches אחרי merge

### Don'ts
- Push ישיר ל-master
- Force push ל-branches משותפים
- Commit של `.env` או secrets
- Merge בלי review (חוץ מ-hotfix)
- Commits ענקיים עם 20 שינויים שונים
