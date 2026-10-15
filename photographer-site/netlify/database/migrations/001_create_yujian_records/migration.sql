CREATE TABLE surveys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  payload JSONB NOT NULL,
  photos JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX surveys_created_at_idx ON surveys (created_at DESC);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);
CREATE TABLE email_deliveries (
  survey_id TEXT PRIMARY KEY REFERENCES surveys(id),
  state TEXT NOT NULL DEFAULT 'pending',
  provider_id TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at BIGINT,
  updated_at BIGINT NOT NULL
);
CREATE TABLE feishu_deliveries (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  source_key TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  file_key TEXT,
  message_id TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at BIGINT,
  target TEXT,
  updated_at BIGINT NOT NULL
);
