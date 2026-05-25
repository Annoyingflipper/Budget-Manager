-- Prevent direct invocation of the seed_user_budget() security-definer function
-- via the Data API (POST /rest/v1/rpc/seed_user_budget). The function is only
-- meant to fire as an after-insert trigger on auth.users; revoking EXECUTE from
-- every non-superuser role closes the public RPC surface while leaving the
-- trigger path intact (triggers run as the function owner regardless of grants).
revoke execute on function public.seed_user_budget() from public, anon, authenticated;
