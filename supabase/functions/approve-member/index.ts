import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  const token = auth.slice(7);
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || who.user?.app_metadata?.role !== "admin") {
    return Response.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  }

  const { application_id } = await req.json();
  const { data: app, error: appErr } = await admin.from("member_applications").select("*").eq("id", application_id).single();
  if (appErr || !app) return Response.json({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  if (app.status !== "pending") return Response.json({ error: "APPLICATION_NOT_PENDING" }, { status: 409 });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    phone: app.phone,
    phone_confirm: true,
    user_metadata: { nickname: app.nickname, bio: app.bio },
    app_metadata: { role: "member" }
  });
  if (createErr || !created.user) return Response.json({ error: createErr?.message || "CREATE_USER_FAILED" }, { status: 400 });

  const now = new Date().toISOString();
  const { error: profileErr } = await admin.from("profiles").insert({
    user_id: created.user.id,
    phone: app.phone,
    email: app.email,
    nickname: app.nickname,
    bio: app.bio,
    membership_status: "approved",
    approved_by: who.user.id,
    approved_at: now
  });
  if (profileErr) return Response.json({ error: profileErr.message }, { status: 400 });

  await admin.from("member_applications").update({
    status: "approved", decided_by: who.user.id, decided_at: now
  }).eq("id", app.id);

  await admin.from("audit_log").insert({
    actor_id: who.user.id, action: "APPROVE_MEMBER", entity: "member_application",
    entity_id: app.id, after_data: { user_id: created.user.id, phone: app.phone, email: app.email }
  });

  return Response.json({ ok: true, message: "Member approved", user_id: created.user.id });
});
