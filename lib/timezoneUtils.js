/**
 * Timezone Utility Functions
 * Handles conversion between UTC and local timezones
 * 
 * FLOW:
 * User Input → LOCAL TIME → Convert to UTC → Store in DB
 * DB (UTC) → Convert to LOCAL TIME → Display/Edit to User
 */

/**
 * Get the timezone offset in minutes for a specific date
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York')
 * @param {Date} date - The date to calculate offset for (accounts for DST)
 * @returns {number} Offset in minutes (negative for behind UTC like -240 for UTC-4)
 */
export function getTimezoneOffset(timezone, date) {
  // Create formatter for target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  // Get what this UTC time looks like in the target timezone
  const parts = new Map();
  formatter.formatToParts(date).forEach(({ type, value }) => {
    parts.set(type, parseInt(value));
  });

  // Construct a UTC date from those local parts
  const tzLocalTime = new Date(
    Date.UTC(
      parts.get('year'),
      parts.get('month') - 1,
      parts.get('day'),
      parts.get('hour'),
      parts.get('minute'),
      parts.get('second')
    )
  );

  // The difference tells us the offset
  // If UTC shows 19:35 but timezone shows 15:35, then timezone is -4 hours
  // offsetMs = tzLocalTime - utcDate (negative means behind UTC)
  const offsetMs = tzLocalTime.getTime() - date.getTime();
  return offsetMs / (60 * 1000); // Convert to minutes
}

/**
 * Convert LOCAL time to UTC ISO string
 * Example: User enters 15:35 in New York timezone (EDT = UTC-4)
 *   → 15:35 EDT becomes 19:35 UTC
 * 
 * @param {string} dateStr - "YYYY-MM-DD" in LOCAL timezone
 * @param {string} timeStr - "HH:MM" in LOCAL timezone  
 * @param {string} timezone - IANA timezone string
 * @returns {string} UTC ISO string
 */
export function localToUTC(dateStr, timeStr, timezone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Create a reference UTC date for this calendar day
  const referenceUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Get the offset for this date (accounts for DST)
  const offsetMinutes = getTimezoneOffset(timezone, referenceUTC);

  // User entered local time, we need to convert to UTC
  // UTC = Local - Offset
  const localTotalMinutes = hours * 60 + minutes;
  const utcTotalMinutes = localTotalMinutes - offsetMinutes;

  // Create UTC date with the adjusted minutes
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  utcDate.setUTCMinutes(utcDate.getUTCMinutes() + utcTotalMinutes);

  return utcDate.toISOString();
}

/**
 * Convert UTC ISO string to LOCAL time
 * Example: Database has 2026-06-16T19:35:00Z (UTC)
 *   → In New York timezone (EDT = UTC-4), displays as 2026-06-16 15:35
 * 
 * @param {string} isoString - UTC ISO string from database
 * @param {string} timezone - IANA timezone string
 * @returns {object} { dateStr: "YYYY-MM-DD", timeStr: "HH:MM" } in LOCAL time
 */
export function utcToLocal(isoString, timezone) {
  const utcDate = new Date(isoString);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  const parts = new Map();
  formatter.formatToParts(utcDate).forEach(({ type, value }) => {
    parts.set(type, value);
  });

  const dateStr = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
  const timeStr = `${parts.get('hour')}:${parts.get('minute')}`;

  return { dateStr, timeStr };
}

export function formatLocalTime(isoString, timezone) {
  const utcDate = new Date(isoString);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  const parts = new Map();
  formatter.formatToParts(utcDate).forEach(({ type, value }) => {
    parts.set(type, value);
  });

  const weekday = parts.get('weekday');
  const day = parts.get('day');
  const month = parts.get('month');
  const year = parts.get('year');
  const hour = parts.get('hour');
  const minute = parts.get('minute');

  return `${weekday}, ${day}-${month}-${year} ${hour}:${minute}`;
}

/**
 * Format a UTC ISO string to dual timezone display
 * @param {string} isoString - UTC ISO string
 * @param {string} eventTimezone - Timezone of the event
 * @param {string} userTimezone - Timezone of the user
 * @returns {object} { primary, secondary }
 */
export function getDualTimezoneDisplay(isoString, eventTimezone, userTimezone) {
  const primary = formatLocalTime(isoString, eventTimezone);
  const eventCity = eventTimezone.split('/').pop().replace(/_/g, ' ');
  
  const hasSecondary = userTimezone && eventTimezone !== userTimezone;
  let secondary = '';
  
  if (hasSecondary) {
    try {
      const d = new Date(isoString);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
      const parts = new Map();
      formatter.formatToParts(d).forEach(({ type, value }) => {
        parts.set(type, value);
      });
      const userCity = userTimezone.split('/').pop().replace(/_/g, ' ');
      secondary = `→ ${parts.get('hour')}:${parts.get('minute')} (${userCity} time)`;
    } catch (e) {
      console.warn("Failed to format secondary time", e);
    }
  }
  
  return {
    primary: `${primary} (${eventCity})`,
    secondary
  };
}

