export function appointmentDayRange(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { start: new Date(year, month - 1, day).toISOString(), end: new Date(year, month - 1, day + 1).toISOString() };
}
