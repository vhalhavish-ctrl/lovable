# KAIJAOWINTER / ไข่เจียวอินเตอร์

Bilingual TH/EN retro pixel-food ordering, membership, and admin web app.

## Menu / เมนู
- Normal — 70 THB — 2 eggs — 5 toppings — 250 g rice
- Plus — 80 THB — 3 eggs — 5 toppings — 250 g rice
- Pro — 90 THB — 4 eggs — 5 toppings — 250 g rice
- Ultra — 100 THB — 5 eggs — 250 g rice
- Every tier includes exactly 5 toppings.

## Experience
Original 8-bit / 16-bit food-world visual language. The project intentionally avoids copying another game's characters, logos, levels, artwork, sounds, or branded trade dress.

## Member flow / สมาชิก
1. Public application: email + phone + nickname + bio.
2. Application remains pending.
3. Admin approves through the Admin screen / approve-member Edge Function.
4. Approval creates the Supabase Auth user with confirmed phone and an approved profile.
5. Member signs in with phone OTP using `shouldCreateUser:false`.
6. Member can order and view history.

## Stack
- Next.js + TypeScript
- Supabase Postgres/Auth/RLS/Edge Functions
- GitHub
- Vercel
- Google Sheets operational mirror + Apps Script two-way sync
- Google Drive for business/technical documentation

## Setup
1. Create a dedicated Supabase project.
2. Apply `supabase/migrations/20260924_kaijaowinter.sql`.
3. Configure an SMS provider in Supabase Auth and enable phone login.
4. Create your first administrator and set trusted app metadata:
   `{"role":"admin"}`
   Do this from a privileged server/Admin API or Dashboard process; do not let users set their own role.
5. Deploy Edge Functions:
   - approve-member (JWT required)
   - sync-to-sheet (JWT required)
   - sync-from-sheet (custom x-sync-secret; JWT verification may be disabled because the function performs its own machine authentication)
6. Add Edge Function secrets:
   - GOOGLE_SHEETS_WEBHOOK_URL
   - GOOGLE_SHEETS_SYNC_SECRET
7. Copy `apps-script/Code.gs` into the bound Apps Script project for the Master Sync Google Sheet.
8. Set Apps Script Properties:
   - SYNC_SHARED_SECRET
   - SUPABASE_SYNC_FUNCTION_URL = URL of sync-from-sheet
9. Deploy Apps Script as Web App and put that URL into GOOGLE_SHEETS_WEBHOOK_URL.
10. Run `installTwoWaySync()` once to create the installable onEdit trigger.
11. Create/connect Vercel project to this repo and add the values from `.env.example`.

## 2-way sync scope
DB → Sheet: canonical profiles, orders, toppings.
Sheet → DB: safe operational edits only:
- ORDERS: status, notes
- TOPPINGS_50: active availability
- MEMBERS: nickname, bio

Membership approval is deliberately **not** accepted from Sheets. It must use the Admin approval flow so Auth user creation and audit logging happen together.

## Security
- Service role key never goes into browser or Google Sheets.
- RLS is enabled on every exposed table.
- User-editable metadata is never used for authorization.
- Order price/egg/rice values are resolved in the database function, not trusted from the browser.
- Exactly five unique active toppings are enforced by the database function.
- Admin actions are authenticated and audited.

## Current connection dependency
The source is complete, but production backend/deployment requires:
- dedicated Supabase project selection + project-cost confirmation,
- SMS provider,
- first admin bootstrap,
- Apps Script Web App deployment URL,
- Vercel project connection and environment values.
