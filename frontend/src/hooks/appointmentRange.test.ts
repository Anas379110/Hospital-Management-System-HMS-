import { expect, it } from 'vitest';
import { appointmentDayRange } from './appointmentRange';
it('maps the selected local calendar day to start-inclusive next-midnight-exclusive UTC boundaries', () => {
  const range = appointmentDayRange('2026-11-26');
  const start = new Date(range.start), end = new Date(range.end);
  expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 10, 26, 0]);
  expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 10, 27, 0]);
});
it('uses calendar rollover rather than a fixed 24 hour increment', () => {
  const range = appointmentDayRange('2026-12-31');
  const end = new Date(range.end);
  expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2027, 0, 1, 0]);
});

it('uses seven local calendar days across year rollover', () => {
  const range = appointmentDayRange('2026-12-28', 7);
  const end = new Date(range.end);
  expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2027, 0, 4, 0]);
});

it('preserves local midnight across DST transitions for day and week', () => {
  for (const date of ['2026-03-08','2026-11-01']) for(const days of [1,7]) {
    const range=appointmentDayRange(date,days);const start=new Date(range.start),end=new Date(range.end);
    expect(start.getHours()).toBe(0);expect(end.getHours()).toBe(0);
    const expected=new Date(start.getFullYear(),start.getMonth(),start.getDate()+days);
    expect(end.getTime()).toBe(expected.getTime());
  }
});
