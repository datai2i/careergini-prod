-- CareerGini Advanced Activity Tracking Schema Updates

-- 1. Enhance Users Table for Login Analytics
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- 2. Ensure profiles table has latest_resume_path for direct admin access
-- (Added in previous steps but ensuring consistency)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latest_resume_filename VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latest_resume_path VARCHAR(255);

-- 3. Indexing for Analytics Performance
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_login_count ON users(login_count);
