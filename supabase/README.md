## Supabase setup (Laundra)

1. Create a Supabase project.
2. In Supabase **SQL Editor**, run `supabase/schema.sql`.
3. Enable Realtime on:
   - `bookings`
   - `booking_events`
   - `booking_tracking`
   - `notifications`
4. In Supabase **Auth**:
   - Enable Email OTP (magic link).
5. Copy env vars into `laundra-next/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # only needed for server-side admin actions
NEXT_PUBLIC_OSRM_API=https://router.project-osrm.org
NEXT_PUBLIC_NOMINATIM_API=https://nominatim.openstreetmap.org
```
