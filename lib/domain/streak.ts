import type { DayCompletion } from "./types";

export function isDayComplete(completion?: DayCompletion) {
  return Boolean(completion?.am && completion?.pm);
}

export function calculateStreak(
  completions: Record<number, DayCompletion>,
  currentDayIndex: number,
  rescuedDayIndex?: number,
) {
  let streak = 0;

  for (let index = 0; index < currentDayIndex; index += 1) {
    if (isDayComplete(completions[index]) || rescuedDayIndex === index) {
      streak += 1;
      continue;
    }
    break;
  }

  if (
    isDayComplete(completions[currentDayIndex]) ||
    rescuedDayIndex === currentDayIndex
  ) {
    streak += 1;
  }

  return streak;
}

export function rescueCandidate(
  completions: Record<number, DayCompletion>,
  currentDayIndex: number,
  rescuedDayIndex?: number,
) {
  if (rescuedDayIndex !== undefined || currentDayIndex < 1) return undefined;

  const yesterday = currentDayIndex - 1;
  return isDayComplete(completions[yesterday]) ? undefined : yesterday;
}
