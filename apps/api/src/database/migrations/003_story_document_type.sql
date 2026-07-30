ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN ('book', 'pdf', 'document', 'text', 'transcript', 'story'));
