-- Add resume tracking columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latest_resume_filename VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latest_resume_path TEXT;
