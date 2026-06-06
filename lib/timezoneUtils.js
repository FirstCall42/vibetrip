/**
 * Timezone Utility Functions
 * Handles conversion between UTC and local timezones
 */

/**
 * Calculate the offset (in minutes) between UTC and the given timezone for a specific date.
 * This accounts for daylight saving time.
 */
export function getTimezoneOffsetMinutes(timezone, utcDate) {
  // Format the UTC date in the target timezone to see what it shows
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = formatter.formatToParts(utcDate);
  
  const getValue = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');

  // Extract the local components as seen in the timezone
  const tzYear = getValue('year');
  const tzMonth = getValue('month');
  const tzDay = getValue('day');
  const tzHour = getValue('hour');
  const tzMinute = getValue('minute');
  const tzSecond = getValue('second');

  // Create a date from these components (treated as browser-local for calculation)
  const tzDate = new Date(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);

  // The difference between UTC time and what the timezone shows
  const offsetMs = utcDate - tzDate;
  return offsetMs / 60000; // Convert to minutes
}

/**
 * Convert local date/time in a given timezone to UTC ISO string
 * @param {string} dateStr - Local date as "YYYY-MM-DD"
 * @param {string} timeStr - Local time as "HH:MM"
 * @param {string} timezone - IANA timezone string (e.g., "America/New_York")
 * @returns {string} UTC ISO string
 */
export function localToUTC(dateStr, timeStr, timezone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Create a date treating this as browser-local time (just a reference point)
  const localDate = new Date(year, month - 1, day, hours, minutes, 0);

  // Get the offset for this date in the target timezone
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, localDate);

  // Convert to UTC by subtracting the offset
  const utcMs = localDate.getTime() - offsetMinutes * 60000;

  return new Date(utcMs).toISOString();
}

/**
 * Convert UTC ISO string to local date/time in a given timezone
 * @param {string} isoString - UTC ISO string
 * @param {string} timezone - IANA timezone string
 * @returns {object} { dateStr: "YYYY-MM-DD", timeStr: "HH:MM" }
 */
export function utcToLocal(isoString, timezone) {
  const utcDate = new Date(isoString);

  // Get the offset for this UTC date
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, utcDate);

  // Convert to local time by adding the offset
  const localMs = utcDate.getTime() + offsetMinutes * 60000;
  const localDate = new Date(localMs);

  // Extract components
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  const hours = String(localDate.getUTCHours()).padStart(2, '0');
  const mins = String(localDate.getUTCMinutes()).padStart(2, '0');

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${mins}`
  };
}

/**
 * Format a UTC ISO string as readable local time with timezone info
 * @param {string} isoString - UTC ISO string
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted string like "Tue, 2026-06-16 15:35 EDT"
 */
export function formatLocalTime(isoString, timezone) {
  const utcDate = new Date(isoString);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return formatter.format(utcDate);
}
