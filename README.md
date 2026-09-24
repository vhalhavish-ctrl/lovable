# KAIJAOWINTER / ไข่เจียวอินเตอร์

Bilingual TH/EN retro pixel-food ordering, membership, admin, and operational sync system.

## Menu / เมนู
| Tier | Price | Eggs | Toppings | Rice |
|---|---:|---:|---:|---:|
| Normal | 70 THB | 2 | 5 | 250 g |
| Plus | 80 THB | 3 | 5 | 250 g |
| Pro | 90 THB | 4 | 5 | 250 g |
| Ultra | 100 THB | 5 | 5 | 250 g |

Every tier includes exactly five topping selections.

## Visual direction / ธีม
Original 8-bit / 16-bit food-game visual language: pixel kitchen, food sprites, ingredient tiles, arcade buttons, chef/egg symbols, colorful retro UI. This project deliberately does **not** copy another game's characters, logos, stages, artwork, audio, or branded trade dress.

## Member flow / สมาชิก
1. Public application: email + phone + nickname + bio.
2. `submit-application` validates and stores the application as `pending`.
3. Admin reviews the queue.
4. `approve-member` approves or rejects with an audit trail.
5. Approval creates the Supabase Auth user and approved profile.
6. Approved member signs in using phone OTP with `shouldCreateUser:false`.
7. Member can edit nickname/bio, create orders, and view order history.

## Stack
- Next.js App Router + TypeScript
- Supabase Postgres + Auth + RLS + Edge Functions
- GitHub
- Vercel
- Google Sheets operational mirror
- Google Apps Script two-way sync
- Google Drive bilingual documentation

## Toppings / เครื่อง 50 อย่าง
20 protein/process-meat choices, 25 vegetables/herbs, and 5 cheese/extras are defined in `lib/catalog.ts`, the SQL seed, and the Master Sync Google Sheet.

## Supabase setup
1. Create a **dedicated KAIJAOWINTER Supabase project**.
2. Apply `supabase/migrations/20260924_kaijaowinter.sql`.
3. Enable Phone Auth and configure an SMS provider.
4. Create the first admin user and set trusted app metadata to `{"role":"admin"}` using a privileged admin process.
5. Deploy:
   - `submit-application` — public application endpoint; custom validation, JWT may be disabled
   - `approve-member` — JWT required; admin only
   - `sync-to-sheet` — JWT required
   - `sync-from-sheet` — custom `x-sync-secret`; JWT may be disabled because it performs machine authentication
6. Add function secrets:
   - `GOOGLE_SHEETS_WEBHOOK_URL`
   - `GOOGLE_SHEETS_SYNC_SECRET`
7. Run Supabase security and performance advisors after migration/deployment.

## Google Sheets 2-way sync
Master Sheet:
https://docs.google.com/spreadsheets/d/1RZrp8mBvaWZ3XNwlRZgDiLFT0cxVhh9Eujn-nzWvnZw/edit

Tabs:
- README
- MENU
- TOPPINGS_50
- MEMBERS
- ORDERS
- ORDER_ITEMS
- APPROVALS
- SYNC_LOG

### DB → Sheet
- Membership applications
- Approved member profiles
- Orders
- Topping availability

### Sheet → DB
Restricted operational edits only:
- ORDERS: `status`, `notes`
- TOPPINGS_50: `active`
- MEMBERS: `nickname`, `bio`

Membership approval is intentionally **not** accepted from Google Sheets. Approval must run through the authenticated Admin flow so Auth user creation and audit logging are atomic.

## Apps Script
Copy `apps-script/Code.gs` into the Apps Script project bound to the Master Sheet.

Script Properties:
- `SYNC_SHARED_SECRET`
- `SUPABASE_SYNC_FUNCTION_URL` = URL of `sync-from-sheet`

Deploy the script as a Web App, then store that Web App URL in the Supabase function secret `GOOGLE_SHEETS_WEBHOOK_URL`. Run `installTwoWaySync()` once.

## Vercel
Connect this repository to a new Vercel project and set:
- `NEXT_PUBLIC_APP_NAME=KAIJAOWINTER`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The browser never needs the service-role key. Production and Preview should use intentionally selected environments.

## Security model
- Every exposed database table has RLS.
- User-editable metadata is never used for authorization.
- Admin role comes from trusted `app_metadata`.
- The service-role key is never committed, never placed in browser code, and never stored in Sheets.
- Order price, egg count, rice weight, topping validity, and exactly-five-toppings rule are enforced server-side.
- The privileged order implementation is kept in a non-exposed `private` schema, with a public invoker wrapper and explicit execution grants.
- Admin decisions and sync failures are logged.

## Google Drive
Bilingual project folder:
https://drive.google.com/drive/folders/1sSf6_7mCkWiIx7TVMMB0f9VdmACmYD7K

## Current production blockers
The source, bilingual documents, master sheet, SQL schema, and Edge Function sources are prepared. Going live still requires:
1. selecting/confirming the Supabase organization and project cost before a dedicated project can be created,
2. an SMS provider for Phone OTP,
3. first-admin bootstrap,
4. Apps Script Web App deployment URL/secret,
5. Vercel project creation/linking. The connected Vercel deployment action is currently unavailable in this session, so source is ready in GitHub but not yet live on a new Vercel URL.

## Repository visibility
This repository is currently **public** in GitHub. No production secret is committed. If the project should be private, change repository visibility before storing any proprietary implementation details beyond this non-secret application source.
