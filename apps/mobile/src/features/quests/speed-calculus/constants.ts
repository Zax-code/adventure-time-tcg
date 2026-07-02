export const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["±", "0", "DEL"],
] as const;
export type KeypadKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "±" | "0" | "DEL";
const MAX_ANSWER_LENGTH = 5;

// ── Input helpers (matching PWA speed-calculus-client.ts) ─────────────

export function appendDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit)) return current;
  if (current.length >= MAX_ANSWER_LENGTH) return current;
  if (current === "0") return digit;
  if (current === "-0") return `-${digit}`;
  if (current === "-") return `-${digit}`;
  return `${current}${digit}`;
}

export function deleteDigit(current: string): string {
  return current.slice(0, -1);
}

export function toggleSign(current: string): string {
  if (!current) return "-";
  if (current === "-") return "";
  if (current.startsWith("-")) return current.slice(1);
  if (current.length >= MAX_ANSWER_LENGTH) return current;
  return `-${current}`;
}

export function canSubmitAnswer(answer: string): boolean {
  return /^-?\d+$/.test(answer.trim());
}

// ── Types ────────────────────────────────────────────────────────────

export type ToastType = { type: "success" | "error"; message: string } | null;
export type FeedbackType = {
  kind: "correct" | "incorrect";
  message: string;
  questionLabel?: string;
  correctAnswer?: number;
} | null;
