export type ArchiveMonthGroup = {
  month: string;
  dates: string[];
};

export function groupArchiveDatesByMonth(dates: string[]): ArchiveMonthGroup[] {
  const groups = new Map<string, string[]>();
  const orderedDates = Array.from(new Set(dates))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort((a, b) => b.localeCompare(a));

  for (const date of orderedDates) {
    const month = date.slice(0, 7);
    const monthDates = groups.get(month) ?? [];
    monthDates.push(date);
    groups.set(month, monthDates);
  }

  return Array.from(groups, ([month, monthDates]) => ({ month, dates: monthDates }));
}
