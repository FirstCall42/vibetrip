-- 1. Add start_timezone and end_timezone columns safely (idempotent)
alter table if exists events add column if not exists start_timezone text;
alter table if exists events add column if not exists end_timezone text;

-- 2. Migrate existing timezone values to the new columns if they are not already set
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='events' and column_name='timezone') then
    update events 
    set 
      start_timezone = coalesce(start_timezone, timezone, 'America/New_York'),
      end_timezone = coalesce(end_timezone, timezone, 'America/New_York')
    where start_timezone is null or end_timezone is null;
  else
    update events
    set
      start_timezone = coalesce(start_timezone, 'America/New_York'),
      end_timezone = coalesce(end_timezone, 'America/New_York')
    where start_timezone is null or end_timezone is null;
  end if;
end $$;

-- 3. Set defaults and apply not-null constraints
alter table events alter column start_timezone set default 'America/New_York';
alter table events alter column end_timezone set default 'America/New_York';

-- Perform a final check to ensure no nulls remain before applying constraints
update events set start_timezone = 'America/New_York' where start_timezone is null;
update events set end_timezone = 'America/New_York' where end_timezone is null;

alter table events alter column start_timezone set not null;
alter table events alter column end_timezone set not null;

-- 4. Safely drop the old timezone column if it exists
alter table events drop column if exists timezone;
