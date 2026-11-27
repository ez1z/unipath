/**
 * Browser helpers shared by the account islands: the quick-question answers in
 * localStorage, and copying them to the profile after sign-in.
 */

export const QUIZ_KEY = 'clavis.quiz';

export interface Quiz {
  countries: string[];
  field: string | null;
  budgetPerYearUsd: number | null;
  englishTest: { name: 'IELTS' | 'TOEFL' | 'Duolingo' | 'none'; score: string } | null;
}

/** localStorage can be missing or blocked (private mode, Telegram webviews). */
export function readQuiz(): Quiz | null {
  try {
    const raw = window.localStorage.getItem(QUIZ_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Quiz> | null;
    if (!value || !Array.isArray(value.countries)) return null;
    return {
      countries: value.countries.filter((c): c is string => typeof c === 'string'),
      field: typeof value.field === 'string' ? value.field : null,
      budgetPerYearUsd: typeof value.budgetPerYearUsd === 'number' ? value.budgetPerYearUsd : null,
      englishTest: value.englishTest ?? null,
    };
  } catch {
    return null;
  }
}

export function writeQuiz(quiz: Quiz): void {
  try {
    window.localStorage.setItem(QUIZ_KEY, JSON.stringify(quiz));
  } catch {
    // Not stored; the matches still show for this visit.
  }
}

/** After sign-in: the answers on this device become the profile's. */
export async function copyQuizToProfile(lang: string): Promise<void> {
  const quiz = readQuiz();
  if (!quiz) return;
  try {
    await fetch('/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz, lang }),
    });
  } catch {
    // Copied next time.
  }
}
