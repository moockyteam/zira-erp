SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_delivered_dn_stock_issue';
