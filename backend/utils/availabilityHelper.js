/**
 * FixIt Local - Dynamic Daily Availability Helper
 * Handles time conversions, discrete slot generation, interval validation,
 * and conflict detection with confirmed bookings.
 */

const { Op } = require('sequelize');

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Convert time string (e.g. '09:00 AM', '14:30', '9:00 AM', '09:00', '18:00', '6:00 PM')
 * to minutes from midnight (0 - 1439).
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim().toUpperCase();

  // Try 12-hour AM/PM format (e.g. "09:00 AM", "9:30 PM", "12:00 PM")
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3];

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  // Try 24-hour format (e.g. "14:30", "09:00")
  const h24Match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Convert minutes from midnight to 12-hour format string (e.g. 540 -> '09:00 AM')
 */
function minutesToTime(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '';
  const total = Math.max(0, Math.min(1439, Math.floor(minutes)));
  let hours = Math.floor(total / 60);
  const mins = total % 60;
  const meridian = hours >= 12 ? 'PM' : 'AM';

  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMins = String(mins).padStart(2, '0');
  return `${paddedHours}:${paddedMins} ${meridian}`;
}

/**
 * Standardize time string into "HH:MM AM/PM"
 */
function standardizeTime(timeStr) {
  const min = timeToMinutes(timeStr);
  if (min === null) return timeStr;
  return minutesToTime(min);
}

/**
 * Check if two time intervals [startA, endA) and [startB, endB) overlap
 */
function intervalsOverlap(startMinA, endMinA, startMinB, endMinB) {
  return Math.max(startMinA, startMinB) < Math.min(endMinA, endMinB);
}

/**
 * Get day name from YYYY-MM-DD
 */
function getDayNameFromDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return DAYS_OF_WEEK[d.getDay()];
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return DAYS_OF_WEEK[parsed.getDay()];
  }
  return null;
}

/**
 * Generate discrete candidate time slots within working hours,
 * taking into account slot duration, busy intervals, and existing bookings.
 */
function generateDailySlots({
  startTime = '09:00 AM',
  endTime = '06:00 PM',
  slotDurationMinutes = 60,
  busyIntervals = [],
  bookedSlots = [],
  isToday = false,
  nowMinutes = null
}) {
  const workStart = timeToMinutes(startTime);
  const workEnd = timeToMinutes(endTime);

  if (workStart === null || workEnd === null || workEnd <= workStart) {
    return { allSlots: [], availableSlots: [], bookedSlots: [], busySlots: [] };
  }

  const duration = Math.max(15, Math.min(480, Number(slotDurationMinutes) || 60));

  // Parse busy intervals into minute ranges
  const parsedBusyRanges = [];
  for (const b of busyIntervals) {
    const bStart = timeToMinutes(b.start || b.startTime);
    const bEnd = timeToMinutes(b.end || b.endTime);
    if (bStart !== null && bEnd !== null && bEnd > bStart) {
      parsedBusyRanges.push({ start: bStart, end: bEnd, reason: b.reason || 'Busy' });
    }
  }

  // Parse booked slots into minute values and standardized string set
  const bookedSet = new Set();
  const bookedRanges = [];
  for (const bk of bookedSlots) {
    const timeStr = typeof bk === 'string' ? bk : (bk.time || '');
    const stdTime = standardizeTime(timeStr);
    bookedSet.add(stdTime);
    bookedSet.add(timeStr);

    const bkMin = timeToMinutes(timeStr);
    if (bkMin !== null) {
      bookedRanges.push({ start: bkMin, end: bkMin + duration });
    }
  }

  const allSlots = [];
  const availableSlots = [];
  const busySlots = [];
  const actuallyBookedSlots = [];

  // Generate slots stepped by duration (or 60 mins if duration >= 60)
  const step = duration >= 60 ? 60 : duration;

  for (let slotStart = workStart; slotStart + duration <= workEnd; slotStart += step) {
    const slotEnd = slotStart + duration;
    const slotLabel = minutesToTime(slotStart);
    allSlots.push(slotLabel);

    // If today, filter out past time slots
    if (isToday && nowMinutes !== null && slotStart <= nowMinutes) {
      continue;
    }

    // Check conflict with busy intervals
    let isBusy = false;
    for (const b of parsedBusyRanges) {
      if (intervalsOverlap(slotStart, slotEnd, b.start, b.end)) {
        isBusy = true;
        break;
      }
    }

    if (isBusy) {
      busySlots.push(slotLabel);
      continue;
    }

    // Check conflict with booked slots
    let isBooked = bookedSet.has(slotLabel);
    if (!isBooked) {
      for (const br of bookedRanges) {
        if (intervalsOverlap(slotStart, slotEnd, br.start, br.end)) {
          isBooked = true;
          break;
        }
      }
    }

    if (isBooked) {
      actuallyBookedSlots.push(slotLabel);
      continue;
    }

    availableSlots.push(slotLabel);
  }

  return {
    allSlots,
    availableSlots,
    bookedSlots: actuallyBookedSlots,
    busySlots
  };
}

/**
 * Check if a proposed interval or working schedule change conflicts with any
 * existing non-cancelled bookings for a provider on a date.
 * Returns array of conflicting bookings.
 */
async function findConflictingBookings({
  BookingModel,
  providerUserId,
  date,
  proposedStartTime = null,
  proposedEndTime = null,
  isDayOff = false,
  isUnavailable = false,
  newBusyInterval = null,
  slotDurationMinutes = 60,
  transaction = null
}) {
  if (!BookingModel || !providerUserId || !date) return [];

  const existingBookings = await BookingModel.findAll({
    where: {
      provider_id: providerUserId,
      date: date,
      status: { [Op.notIn]: ['cancelled', 'rejected'] }
    },
    transaction
  });

  if (existingBookings.length === 0) return [];

  // If the entire day is marked as day off or unavailable, all existing bookings conflict!
  if (isDayOff || isUnavailable) {
    return existingBookings.map(b => ({
      id: b.id,
      bookingNumber: b.booking_number,
      serviceTitle: b.service_title,
      date: b.date,
      time: b.time,
      status: b.status,
      customerName: b.customer?.name || 'Customer'
    }));
  }

  const duration = Number(slotDurationMinutes) || 60;
  const conflicts = [];

  // Check working hours boundaries
  const workStartMin = proposedStartTime ? timeToMinutes(proposedStartTime) : null;
  const workEndMin = proposedEndTime ? timeToMinutes(proposedEndTime) : null;

  // Check new busy interval
  const busyStartMin = newBusyInterval ? timeToMinutes(newBusyInterval.start || newBusyInterval.startTime) : null;
  const busyEndMin = newBusyInterval ? timeToMinutes(newBusyInterval.end || newBusyInterval.endTime) : null;

  for (const b of existingBookings) {
    const bookingStart = timeToMinutes(b.time);
    if (bookingStart === null) continue;
    const bookingEnd = bookingStart + duration;

    let hasConflict = false;

    // Check outside proposed working hours
    if (workStartMin !== null && bookingStart < workStartMin) {
      hasConflict = true;
    }
    if (workEndMin !== null && bookingEnd > workEndMin) {
      hasConflict = true;
    }

    // Check overlapping proposed busy interval
    if (busyStartMin !== null && busyEndMin !== null) {
      if (intervalsOverlap(bookingStart, bookingEnd, busyStartMin, busyEndMin)) {
        hasConflict = true;
      }
    }

    if (hasConflict) {
      conflicts.push({
        id: b.id,
        bookingNumber: b.booking_number,
        serviceTitle: b.service_title,
        date: b.date,
        time: b.time,
        status: b.status,
        customerName: b.customer?.name || 'Customer'
      });
    }
  }

  return conflicts;
}

module.exports = {
  DAYS_OF_WEEK,
  timeToMinutes,
  minutesToTime,
  standardizeTime,
  intervalsOverlap,
  getDayNameFromDate,
  generateDailySlots,
  findConflictingBookings
};
