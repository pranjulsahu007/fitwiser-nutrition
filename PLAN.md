# Temporary Meal Tracking Web App - Emergency Recovery Plan

**Rule: Everything below is additive and non-destructive. No existing production tables or data should be dropped, renamed, or deleted.**

## 1. Executive Summary

This plan provides the fastest, safest recovery path to restore meal tracking functionality for Fitwiser clients while the mobile app is crashing. By deploying a lightweight, mobile-optimized React web app interacting directly with a strictly additive schema on the existing Supabase backend, we completely isolate the recovery effort from the existing production architecture. This guarantees that current coach assignment flows remain perfectly intact and that no existing data is risked.

## 2. Non-Destructive Database Safety Plan

-   **Backup Before Migration**: Trigger a manual snapshot/backup in the Supabase dashboard before applying any SQL.
-   **Staging Verification**: Apply the additive SQL to a staging or local instance first to verify syntax and absence of conflicts.
-   **Additive-Only Migration**: We will ONLY use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. No `DROP` or `RENAME` commands will be used.
-   **No Destructive SQL**: Existing tables (`users`, `meal_assignments`, etc.) will not be modified.
-   **Rollback Strategy**: Since the schema is purely additive, a rollback consists simply of dropping the newly created `meal_logs` table. No existing data needs to be restored.
-   **Production Checklist**: Ensure RLS is enabled on new tables before deploying the client app.

## 3. Confirmed vs Inferred Schema Map

**Confirmed Existing Schema (from context):**
-   `users`
-   `client_coach_relationships`
-   `meal_assignments`
-   `meal_plan_assignments`

**Inferred Schema (from common patterns, TO VERIFY):**
-   `meal_assignments` likely links `client_id` to a `meal_id` or contains inline text detailing the meal, date, and time.
-   `users` table relies on Supabase Auth `auth.users`.

**Proposed Additive Schema ONLY:**
-   `meal_logs` (New table to store client adherence).

## 4. Compatibility-First Data Model

To preserve the coach dashboard, we will *not* alter how meals are assigned (`meal_assignments`). Instead, we create a new `meal_logs` table that references the `meal_assignments.id` (or date/meal_time if IDs are transient). 

By using an isolated log table, if the coach dashboard expects a specific structure for adherence, we can later create an additive `CREATE OR REPLACE VIEW` that shapes the new `meal_logs` into whatever legacy format the coach dashboard consumed, ensuring zero friction.

## 5. Detailed Additive Schema Proposal

### Table: `meal_logs`
-   **Purpose**: Records client adherence strictly as new rows without mutating assignments.
-   **Columns**:
    -   `id` (uuid, PK, default gen_random_uuid())
    -   `client_id` (uuid, FK to auth.users, not null)
    -   `assignment_id` (uuid, nullable FK to `meal_assignments`. Nullable just in case they log an unassigned custom meal)
    -   `log_date` (date, not null)
    -   `meal_type` (text, e.g., 'Breakfast', 'Lunch', 'Dinner', 'Snack' - useful if assignment_id is null)
    -   `adherence_status` (text, check constraint: 'followed', 'partially_followed', 'skipped', 'replaced', 'custom')
    -   `notes_for_coach` (text, nullable)
    -   `created_at` (timestamptz, default now())
    -   `updated_at` (timestamptz, default now())

## 6. Safe SQL Deliverables

```sql
-- What: Create an isolated table for tracking client meal adherence.
-- Why it is safe: It is completely new and does not modify any existing tables.
-- Depends on: Requires auth.users (Supabase default) to exist.

CREATE TABLE IF NOT EXISTS public.meal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES auth.users(id),
    assignment_id UUID, -- Deliberately no FK constraint yet if meal_assignments schema is uncertain. High-risk to enforce FK if we don't know the exact column type, so keeping it raw UUID for safety.
    log_date DATE NOT NULL,
    meal_type TEXT,
    adherence_status TEXT CHECK (adherence_status IN ('followed', 'partially_followed', 'skipped', 'replaced', 'custom')),
    notes_for_coach TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- What: Index for fast querying by the client
CREATE INDEX IF NOT EXISTS idx_meal_logs_client_date ON public.meal_logs(client_id, log_date);
```

## 7. RLS Policy Design

```sql
-- What: Enable Row Level Security
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

-- What: Policy allowing clients to view ONLY their own logs
CREATE POLICY "Clients can view their own meal logs" 
ON public.meal_logs FOR SELECT 
TO authenticated 
USING (auth.uid() = client_id);

-- What: Policy allowing clients to insert their own logs
CREATE POLICY "Clients can insert their own meal logs" 
ON public.meal_logs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = client_id);

-- What: Policy allowing coaches to view their clients' logs
-- Note: Assuming client_coach_relationships has coach_id and client_id
CREATE POLICY "Coaches can view their clients meal logs" 
ON public.meal_logs FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.client_coach_relationships ccr
        WHERE ccr.coach_id = auth.uid() AND ccr.client_id = meal_logs.client_id
    )
);
```

## 8. Safe Migration Strategy

1.  **Inspect current schema**: Briefly query the production `meal_assignments` table to verify PK UUID types using the Supabase SQL Editor.
2.  **Take backup**: Use Supabase Dashboard -> Database -> Backups.
3.  **Apply SQL in Staging**: Paste the additive SQL into a staging project.
4.  **Validate Coach Dashboard**: Check that the coach dashboard still loads perfectly.
5.  **Validate Web App Flows**: Insert a test row via the temporary web app.
6.  **Apply to Production**: Execute the ADDITIVE ONLY SQL in the production SQL editor.

## 9. Frontend Architecture

**Selection: React + Vite + Supabase**
-   **Why**: It is the fastest stable web stack for emergency use. It compiles quickly, deploys statically anywhere instantly (Vercel, Netlify, S3), and has no complex SSR routing or server-side data fetching constraints that require managing Node.js infrastructure during an emergency.
-   **Env Vars**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
-   **Auth**: Supabase Auth UI / simple JWT session handling based on `supabase.auth.getSession()`
-   **Structure**: 
    -   `src/components`: UI elements
    -   `src/pages`: Route views
    -   `src/lib`: Supabase client and utils

## 10. Page-by-Page MVP

-   **`/login`**: Simple email/password or magic link login relying on Supabase Auth.
-   **`/` (Today)**: Shows today's date. Fetches records from `meal_assignments` (if we know the schema) or falls back to standard time blocks (Breakfast, Lunch, etc.). Allows tapping a block to open a logging modal (Followed, Skipped, etc.).
-   **`/history`**: A list of past logs grouped by log_date.
-   **`/profile`**: Minimal user details and logout button.

## 11. Example Safe Queries

**Insert meal log:**
```typescript
const { data, error } = await supabase
  .from('meal_logs')
  .insert([{
    client_id: user.id,
    log_date: '2023-10-25',
    meal_type: 'Breakfast',
    adherence_status: 'followed',
    notes_for_coach: 'Felt great!'
  }]);
```

**Fetch meal history:**
```typescript
const { data, error } = await supabase
  .from('meal_logs')
  .select('*')
  .eq('client_id', user.id)
  .order('log_date', { ascending: false });
```

## 12. Coach Dashboard Compatibility Section

By generating a completely separate `meal_logs` table, **the existing coach dashboard keeps assigning meals exactly as before**. The assignments table remains untouched. 

To allow coaches to read the new adherence data *without* altering the coach dashboard's frontend code, we have two paths:
1.  **Additive API/Route**: If the dashboard has a custom backend, add a simple endpoint reading `meal_logs`.
2.  **View Layer (Preferred if dashboard queries DB directly)**: If the dashboard expects meal statuses inside `meal_assignments`, we can construct an additive view:
```sql
-- High-risk - requires manual review against actual dashboard source code
-- CREATE OR REPLACE VIEW public.vw_meal_assignments_with_status AS ...
```

## 13. Risks and Blockers

-   **Schema mismatch risk**: Not having the exact `meal_assignments` column names could prevent displaying accurate "Assigned" meals to the client. *Mitigation: The MVP allows logging purely based on "Breakfast/Lunch/Dinner" if assignment fetching fails.*
-   **Role/RLS uncertainty**: We assume `client_coach_relationships` exists. If not, the coach view policy may fail.
-   **Date/Timezone mismatch**: Ensure clients log based on their local date string (YYYY-MM-DD) to avoid GMT shift bugs.

## 14. Acceptance Criteria

-   [ ] Additive SQL applied to DB with zero errors.
-   [ ] Client can login on mobile web.
-   [ ] Client can submit a meal log.
-   [ ] Meal log successfully appears in the isolated `meal_logs` table via Supabase dashboard.
-   [ ] Original mobile app/coach dashboard shows zero regressions during manual smoke testing.

---
*End of Plan*
