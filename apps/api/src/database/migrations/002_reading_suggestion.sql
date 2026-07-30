ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reading_suggestion TEXT;

ALTER TABLE response_cache
  ADD COLUMN IF NOT EXISTS reading_suggestion TEXT;
