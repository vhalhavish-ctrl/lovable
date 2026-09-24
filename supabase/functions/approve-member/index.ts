import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey);
  const token = auth.slice(7);
  const { data: who, error: whoErr } = await db.auth.getUser(token);
  if (whoErr || who.user?.app_metadata?.role !== "admin") {
    return Response.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  }

  const { application_id, decision = "approved", admin_note = "" } = await req.json();
  if (!["approved","rejected"].includes(decision)) return Response.json({ error: "INVALID_DECISION" }, { status: 400 });

  const { data: app, error: appErr } = await db.from("member_applications").select("*").eq("id", application_id).single();
  if (appErr || !app) return Response.json({ error: "APPLICATION_NOT_FOUND" }, { status: 404 });
  if (app.status !== "pending") return Response.json({ error: "APPLICATION_NOT_PENDING" }, { status: 409 });

  const now = new Date().toISOString();

  if (decision === "rejected") {
    await db.from("member_applications").update({
      status:"rejected", admin_note:String(admin_note).slice(0,500), decided_by:who.user.id, decided_at:now
    }).eq("id",app.id);
    await db.from("audit_log").insert({
      actor_id:who.user.id, action:"REJECT_MEMBER", entity:"member_application", entity_id:app.id,
      after_data:{ phone:app.phone, email:app.email }
    });
    return Response.json({ ok:true, message:"Member application rejected" });
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    phone: app.phone,
    phone_confirm: true,
    user_metadata: { nickname: app.nickname, bio: app.bio },
    app_metadata: { role: "member" }
  });
  if (createErr || !created.user) return Response.json({ error: createErr?.message || "CREATE_USER_FAILED" }, { status: 400 });

  const profile = {
    user_id:created.user.id, phone:app.phone, email:app.email, nickname:app.nickname, bio:app.bio,
    membership_status:"approved", approved_by:who.user.id, approved_at:now
  };
  const { data: savedProfile, error: profileErr } = await db.from("profiles").insert(profile).select("*").single();
  if (profileErr) {
    await db.auth.admin.deleteUser(created.user.id);
    return Response.json({ error: profileErr.message }, { status: 400 });
  }

  await db.from("member_applications").update({
    status:"approved", admin_note:String(admin_note).slice(0,500), decided_by:who.user.id, decided_at:now
  }).eq("id", app.id);

  await db.from("audit_log").insert({
    actor_id: who.user.id, action:"APPROVE_MEMBER", entity:"member_application", entity_id:app.id,
    after_data:{ user_id:created.user.id, phone:app.phone, email:app.email }
  });

  const webhook = Deno.env.get("GOOGLE_SHEETS_WEBHOOK_URL");
  const secret = Deno.env.get("GOOGLE_SHEETS_SYNC_SECRET");
  if (webhook && secret) {
    try {
      await fetch(webhook,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({secret,entity:"profiles",record:savedProfile})});
    } catch (_) {}
  }

  return Response.json({ ok:true, message:"Member approved", user_id:created.user.id });
});
