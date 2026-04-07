
-- Delete duplicate ev_holdings, keeping only the oldest per symbol+user
DELETE FROM ev_holdings
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, symbol) id
  FROM ev_holdings
  WHERE is_closed = false
  ORDER BY user_id, symbol, created_at ASC
)
AND is_closed = false;
