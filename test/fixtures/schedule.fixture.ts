import { Schedule } from '../../app/services/api/api.types';

export function newSchedule() {
  const newSchedule: Partial<Schedule> = {
    frequency: 'weekly',
    intervals: [{ day: 3, weeks: 1 }],
    time: '10:00',
    isActive: true,
  };

  return newSchedule;
}