import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("GOOGLE_SHEETS_SYNC_SECRET");
  const supplied = req.headers.get("x-sync-secret");
  if (!expected || !supplied || supplied !== expected) return Response.json({ error: "INVALID_SYNC_SECRET" }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, service);
  const { entity, record } = await req.json();

  try {
    if (entity === "orders") {
      const allowedStatus = ["SUBMITTED","ACCEPTED","COOKING","READY","COMPLETED","CANCELLED"];
      if (!record?.id || !allowedStatus.includes(record.status)) throw new Error("INVALID_ORDER_PATCH");
      const { error } = await db.from("orders").update({ status:record.status, notes:String(record.notes||"").slice(0,500) }).eq("id",record.id);
      if (error) throw error;
    } else if (entity === "toppings") {
      if (!record?.code || typeof record.active !== "boolean") throw new Error("INVALID_TOPPING_PATCH");
      const { error } = await db.from("toppings").update({ active:record.active }).eq("code",record.code);
      if (error) throw error;
    } else if (entity === "profiles") {
      if (!record?.user_id) throw new Error("INVALID_PROFILE_PATCH");
      const { error } = await db.from("profiles").update({
        nickname:String(record.nickname||"").slice(0,80),
        bio:String(record.bio||"").slice(0,500)
      }).eq("user_id",record.user_id);
      if (error) throw error;
    } else {
      throw new Error("ENTITY_NOT_ALLOWED");
    }

    await db.from("sync_log").insert({
      direction:"SHEET_TO_DB", entity, entity_id:String(record.id||record.code||record.user_id),
      source_version:record.sync_version ?? null, status:"OK"
    });
    return Response.json({ ok:true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("sync_log").insert({
      direction:"SHEET_TO_DB", entity:String(entity||"unknown"),
      entity_id:String(record?.id||record?.code||record?.user_id||"unknown"),
      source_version:record?.sync_version ?? null, status:"ERROR", error_message:message.slice(0,500)
    });
    return Response.json({ error:message }, { status:400 });
  }
});
