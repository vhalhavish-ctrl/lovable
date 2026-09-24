import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhook = Deno.env.get("GOOGLE_SHEETS_WEBHOOK_URL");
  const secret = Deno.env.get("GOOGLE_SHEETS_SYNC_SECRET");
  if (!webhook || !secret) return Response.json({ error: "SYNC_NOT_CONFIGURED" }, { status: 503 });

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);
  const { entity, id } = await req.json();
  const allowed = ["profiles","orders","toppings"];
  if (!allowed.includes(entity)) return Response.json({ error: "ENTITY_NOT_ALLOWED" }, { status: 400 });

  let query = userClient.from(entity).select(entity === "orders" ? "*,order_items(*)" : "*");
  if (entity === "profiles") query = query.eq("user_id", id);
  else if (entity === "toppings") query = query.eq("code", id);
  else query = query.eq("id", id);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return Response.json({ error: error?.message || "NOT_FOUND" }, { status: 404 });

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, entity, record: data })
  });
  const body = await res.text();
  await admin.from("sync_log").insert({
    direction:"DB_TO_SHEET", entity, entity_id:String(id),
    source_version:(data as any).sync_version ?? null,
    status:res.ok?"OK":"ERROR", error_message:res.ok?null:body.slice(0,500)
  });
  return Response.json({ ok:res.ok, sheet_status:res.status, sheet_response:body.slice(0,500) }, { status: res.ok ? 200 : 502 });
});
