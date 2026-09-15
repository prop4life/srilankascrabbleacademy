# SLSA Event Photo Portal

Prepared on the isolated `event-photo-portal` branch. Nothing is live yet.

Includes a public, mobile-friendly event gallery; full-screen photographs; event names, dates, captions and cover images; Supabase database/storage schema; public read access; and administrator-only write policies.

Next: provision Supabase, add the project URL and anonymous browser key to `supabase-config.js`, add the administrator dashboard, test uploads, and only then merge the gallery links into the live site.

Never put a Supabase service-role key or GitHub token in browser files.
