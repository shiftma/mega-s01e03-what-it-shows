// What #4471 holds once each report is read for what it shows, not for its subject line.
// causes.ts tells `parser` from `hint`. A one-day move is neither: the date is not flipped, it
// slips by a day (desk-notes.json). It gets its own problem. Counts follow the desk's view
// (CauseTable): a one-day report is still counted where it is filed, by tenant, so it shows in
// its cause's count and again under `one-day`.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day';
export const PROBLEMS: readonly Problem[] = ['parser', 'hint', 'one-day'];

export function problemsOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem[] {
  const cause = causeOf(r, t);
  return [...(cause ? [cause] : []), ...(oneDayMove.includes(r.id) ? (['one-day'] as const) : [])];
}

export type ProblemGroup = {
  problem: Problem | 'unplaced';
  reports: Report[];
  // Of these, how many are one-day moves counted here because this is where they are filed.
  alsoOneDay: number;
  tenants: string[];
  channels: Record<string, number>;
  // Reports where intake's tag (a guess from the browser) differs from the problem.
  mistagged: number;
  firstSeen: string;
  lastSeen: string;
};

export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { merged: Report[]; groups: ProblemGroup[] } {
  const merged = uniqueById(all).filter((r) => r.mergedInto === ticket);
  const order: ProblemGroup['problem'][] = [...PROBLEMS, 'unplaced'];
  const groups = order
    .map((problem) => {
      const rs = merged.filter((r) => {
        const ps = problemsOf(r, tenantOf(r), oneDayMove);
        return problem === 'unplaced' ? ps.length === 0 : ps.includes(problem);
      });
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        alsoOneDay: problem === 'one-day' ? 0 : rs.filter((r) => oneDayMove.includes(r.id)).length,
        tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
        channels: rs.reduce<Record<string, number>>((n, r) => ({ ...n, [r.channel]: (n[r.channel] ?? 0) + 1 }), {}),
        mistagged: rs.filter((r) => r.meta.intakeTag !== problem).length,
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .filter((g) => g.reports.length > 0);
  return { merged, groups };
}
