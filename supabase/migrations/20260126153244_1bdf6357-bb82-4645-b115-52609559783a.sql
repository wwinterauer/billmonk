-- Create unique index on category name (case-insensitive)
-- System categories: unique by name (user_id is null)
-- User categories: unique by name per user
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx 
ON categories (LOWER(name), COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));