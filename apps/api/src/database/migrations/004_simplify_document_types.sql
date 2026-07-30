ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

UPDATE documents SET type = 'pdf' WHERE type IN ('book', 'document');
UPDATE documents SET type = 'citation' WHERE type = 'text';

ALTER TABLE documents
  ALTER COLUMN type SET DEFAULT 'pdf';

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN ('pdf', 'citation', 'story', 'transcript'));
