export type StatsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export const statsPeriods: { value: StatsPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

export function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function periodBounds(period: StatsPeriod, anchorValue: string) {
  if (period === 'all') return null;

  const anchor = parseLocalDate(anchorValue);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  if (period === 'day') {
    return {
      start: new Date(year, month, day),
      end: new Date(year, month, day + 1),
    };
  }
  if (period === 'week') {
    const mondayOffset = (anchor.getDay() + 6) % 7;
    return {
      start: new Date(year, month, day - mondayOffset),
      end: new Date(year, month, day - mondayOffset + 7),
    };
  }
  if (period === 'month') {
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 1),
    };
  }
  if (period === 'quarter') {
    const quarterMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterMonth, 1),
      end: new Date(year, quarterMonth + 3, 1),
    };
  }
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  };
}

export function dateInPeriod(
  value: string,
  bounds: ReturnType<typeof periodBounds>,
) {
  if (!bounds) return true;
  const date = parseLocalDate(value);
  return date >= bounds.start && date < bounds.end;
}

export function statsPeriodLabel(period: StatsPeriod, anchorValue: string) {
  if (period === 'all') return 'All time';
  const anchor = parseLocalDate(anchorValue);
  const bounds = periodBounds(period, anchorValue);

  if (period === 'day') {
    return anchor.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (period === 'week' && bounds) {
    const end = new Date(bounds.end);
    end.setDate(end.getDate() - 1);
    return `${bounds.start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}–${end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
  if (period === 'month') {
    return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  if (period === 'quarter') {
    return `Q${Math.floor(anchor.getMonth() / 3) + 1} ${anchor.getFullYear()}`;
  }
  return String(anchor.getFullYear());
}

export function statsTermOption(period: StatsPeriod, date: Date) {
  const anchor = localDateValue(date);
  if (period === 'day') return { value: anchor, label: statsPeriodLabel(period, anchor) };
  if (period === 'week') {
    const bounds = periodBounds(period, anchor);
    return {
      value: bounds ? localDateValue(bounds.start) : anchor,
      label: statsPeriodLabel(period, anchor),
    };
  }
  if (period === 'month') {
    const value = localDateValue(new Date(date.getFullYear(), date.getMonth(), 1));
    return { value, label: statsPeriodLabel(period, value) };
  }
  if (period === 'quarter') {
    const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
    const value = localDateValue(new Date(date.getFullYear(), quarterMonth, 1));
    return { value, label: statsPeriodLabel(period, value) };
  }
  if (period === 'year') {
    const value = localDateValue(new Date(date.getFullYear(), 0, 1));
    return { value, label: statsPeriodLabel(period, value) };
  }
  return { value: 'all', label: 'All time' };
}

export function buildStatsTermOptions(period: StatsPeriod, dateValues: string[]) {
  if (period === 'all') return [{ value: 'all', label: 'All time' }];

  const unique = new Map<string, string>();
  for (const date of [new Date(), ...dateValues.map(parseLocalDate)]) {
    const option = statsTermOption(period, date);
    unique.set(option.value, option.label);
  }
  return Array.from(unique, ([value, label]) => ({ value, label })).sort((a, b) =>
    b.value.localeCompare(a.value),
  );
}
