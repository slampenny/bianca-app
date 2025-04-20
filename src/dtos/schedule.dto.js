// schedule.dto.js
const ScheduleDTO = (schedule) => {
  const { _id, patient, frequency, intervals, isActive, time, nextCallDate } = schedule;

  const id = _id;
  const patientId = patient ? (typeof patient === 'object' ? patient._id : patient) : null;

  // Transform intervals to only include necessary properties
  const intervalData = intervals.map((interval) => ({
    day: interval.day,
    weeks: interval.weeks,
  }));

  return {
    id,
    patient: patientId,
    frequency,
    intervals: intervalData,
    isActive,
    nextCallDate,
    time,
  };
};

module.exports = ScheduleDTO;
