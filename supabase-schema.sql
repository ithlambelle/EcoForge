-- Supabase schema for Waterer extension
-- Run these SQL commands in your Supabase SQL editor

-- Users table: stores user survey data and average usage
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  survey_answers JSONB NOT NULL,
  average_usage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queries table: tracks individual AI queries
CREATE TABLE IF NOT EXISTS queries (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  water_usage INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collective totals table: tracks total water usage across all users
CREATE TABLE IF NOT EXISTS collective_totals (
  id SERIAL PRIMARY KEY,
  total_usage BIGINT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_timestamp ON queries(timestamp);
CREATE INDEX IF NOT EXISTS idx_queries_model ON queries(model);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collective_totals_updated_at BEFORE UPDATE ON collective_totals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial collective total if it doesn't exist
INSERT INTO collective_totals (total_usage) 
VALUES (0) 
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS) - optional, adjust based on your needs
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE collective_totals ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (adjust based on your security needs)
-- In production, you should use proper authentication
CREATE POLICY "Allow all operations on users" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on queries" ON queries
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on collective_totals" ON collective_totals
    FOR ALL USING (true) WITH CHECK (true);

