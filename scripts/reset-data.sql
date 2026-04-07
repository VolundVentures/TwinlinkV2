-- Reset all content data (keep users, orgs, credit structure)
-- Run this in Supabase SQL Editor

-- Delete in order of foreign key dependencies
DELETE FROM generation_assets;
DELETE FROM agent_sessions;
DELETE FROM generations;
DELETE FROM competitor_ads;
DELETE FROM competitor_profiles;
DELETE FROM brands;
DELETE FROM credit_transactions;

-- Reset credit balances to 500
UPDATE credit_balances SET balance = 500;

-- Verify
SELECT 'generations' as tbl, count(*) FROM generations
UNION ALL SELECT 'brands', count(*) FROM brands
UNION ALL SELECT 'credit_balances', count(*) FROM credit_balances;
