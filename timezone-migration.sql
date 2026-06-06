-- Add timezone column to events table (idempotent)
alter table if exists events add column if not exists timezone text default 'America/New_York';

-- Update all existing events to use America/New_York timezone
-- (This assumes they were entered in NY time originally)
update events set timezone = 'America/New_York' where timezone is null or timezone = '';

-- Make timezone not null going forward
alter table events alter column timezone set not null;

-- You can reference these timezones for later updates:
-- Common IANA timezone strings:
-- America/New_York, America/Chicago, America/Denver, America/Los_Angeles
-- Europe/London, Europe/Paris, Europe/Berlin, Europe/Madrid
-- Asia/Tokyo, Asia/Shanghai, Asia/Hong_Kong, Asia/Singapore
-- Australia/Sydney, Australia/Melbourne
-- etc.
