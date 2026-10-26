// Daily streak rules, pure (ported from Streak.luau, without Streak Freezes).
//
//   * Solving the daily the day after the last solve: streak + 1.
//   * A missed day restarts it at 1 on the next solve.
//   * Giving up the daily ends the streak (0).
//   * The streak SHOWN is 0 as soon as a day was missed, even before the
//     player comes back, so nobody sees a number they've lost.

export type StreakState = {
  streak: number;
  bestStreak: number;
  lastSolvedDay: number; // -1 = never
};

// Days skipped between the last solve and `today` (0 = solved yesterday).
function missed(s: StreakState, today: number): number {
  return s.lastSolvedDay < 0 ? Infinity : today - s.lastSolvedDay - 1;
}

export function shown(s: StreakState, today: number): number {
  return s.streak > 0 && missed(s, today) <= 0 ? s.streak : 0;
}

export function onSolve(s: StreakState, today: number): void {
  if (s.lastSolvedDay === today) return;
  s.streak = s.streak > 0 && missed(s, today) === 0 ? s.streak + 1 : 1;
  s.lastSolvedDay = today;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
}

export function onGiveUp(s: StreakState): void {
  s.streak = 0;
}
