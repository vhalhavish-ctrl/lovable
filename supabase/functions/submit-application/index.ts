import { createClient } from "jsr:@supabase/supabase-js@2";

function normalizeThaiPhone(raw: string) {
  const s = String(raw || "").replace(/[\s()-]/g,"");
  if (/^0[0-9]{8,9}$/.test(s)) return "+66" + s.slice(1);
  return s;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status:405 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, service);

  const body = await req.json().catch(()=>({}));
  const email = String(body.email || "").trim().toLowerCase();
  const phone = normalizeThaiPhone(body.phone);
  const nickname = String(body.nickname || "").trim().slice(0,80);
  const bio = String(body.bio || "").trim().slice(0,500);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({error:"INVALID_EMAIL"},{status:400});
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return Response.json({error:"INVALID_PHONE"},{status:400});
  if (!nickname) return Response.json({error:"NICKNAME_REQUIRED"},{status:400});

  const { data: existing } = await db.from("member_applications")
    .select("id,status").eq("phone",phone).eq("status","pending").maybeSingle();
  if (existing) return Response.json({error:"APPLICATION_ALREADY_PENDING"},{status:409});

  const { data: app, error } = await db.from("member_applications")
    .insert({email,phone,nickname,bio,status:"pending"}).select("*").single();
  if (error || !app) return Response.json({error:error?.message || "CREATE_APPLICATION_FAILED"},{status:400});

  const webhook = Deno.env.get("GOOGLE_SHEETS_WEBHOOK_URL");
  const secret = Deno.env.get("GOOGLE_SHEETS_SYNC_SECRET");
  if (webhook && secret) {
    try {
      const res = await fetch(webhook,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({secret,entity:"member_applications",record:app})
      });
      await db.from("sync_log").insert({
        direction:"DB_TO_SHEET",entity:"member_applications",entity_id:app.id,
        status:res.ok?"OK":"ERROR",error_message:res.ok?null:(await res.text()).slice(0,500)
      });
    } catch (e) {
      await db.from("sync_log").insert({
        direction:"DB_TO_SHEET",entity:"member_applications",entity_id:app.id,
        status:"ERROR",error_message:String(e).slice(0,500)
      });
    }
  }

  return Response.json({ok:true,application_id:app.id,status:"pending"});
});
