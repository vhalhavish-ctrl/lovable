"use client";

import { useEffect, useMemo, useState } from "react";
import { MENU_TIERS, TOPPINGS, type MenuTier } from "@/lib/catalog";
import { getSupabase } from "@/lib/supabase-browser";

type Lang = "th" | "en";
type View = "home" | "order" | "apply" | "login" | "member" | "admin";

const copy = {
  th: {
    title:"ไข่เจียวอินเตอร์", sub:"เลือก 5 เครื่อง • ข้าว 250 กรัม • โลกอาหารพิกเซล",
    home:"หน้าแรก", order:"สั่งออเดอร์", apply:"สมัครสมาชิก", login:"เข้าสู่ระบบ", member:"สมาชิก", admin:"แอดมิน",
    pickTier:"1) เลือกระดับไข่", pickTop:"2) เลือกเครื่อง 5 อย่าง", review:"3) ตรวจออเดอร์",
    selected:"เลือกแล้ว", submit:"ยืนยันออเดอร์", pending:"กำลังดำเนินการ...", need5:"กรุณาเลือกให้ครบ 5 อย่าง",
    demo:"โหมด Preview: หน้าตาพร้อมใช้งาน แต่ยังไม่ได้ผูก Supabase Production",
    applyTitle:"สมัครสมาชิก", email:"อีเมล", phone:"เบอร์โทร (+66...)", nickname:"ชื่อเล่น", bio:"Bio / สิ่งที่ชอบ",
    sendApply:"ส่งคำขอสมัคร", appSent:"ส่งคำขอแล้ว รอแอดมินอนุมัติ",
    loginTitle:"เข้าสู่ระบบด้วยเบอร์โทร", sendOtp:"ส่ง OTP", otp:"รหัส OTP 6 หลัก", verify:"ยืนยัน OTP",
    history:"ประวัติออเดอร์", profile:"โปรไฟล์สมาชิก", save:"บันทึก",
    approvals:"คำขอรออนุมัติ", approve:"อนุมัติ", reject:"ปฏิเสธ", orders:"ออเดอร์ทั้งหมด",
    noData:"ยังไม่มีข้อมูล", signout:"ออกจากระบบ", backend:"Backend ยังไม่ถูกตั้งค่า"
  },
  en: {
    title:"KAIJAOWINTER", sub:"Pick 5 toppings • 250 g rice • Pixel food world",
    home:"Home", order:"Order", apply:"Apply", login:"Login", member:"Member", admin:"Admin",
    pickTier:"1) Choose egg tier", pickTop:"2) Pick exactly 5 toppings", review:"3) Review order",
    selected:"Selected", submit:"Submit order", pending:"Working...", need5:"Please select exactly 5 toppings",
    demo:"Preview mode: the UI is ready, but the production Supabase project is not connected yet.",
    applyTitle:"Membership application", email:"Email", phone:"Phone (+66...)", nickname:"Nickname", bio:"Bio / what you like",
    sendApply:"Submit application", appSent:"Application sent. Waiting for admin approval.",
    loginTitle:"Phone login", sendOtp:"Send OTP", otp:"6-digit OTP", verify:"Verify OTP",
    history:"Order history", profile:"Member profile", save:"Save",
    approvals:"Pending approvals", approve:"Approve", reject:"Reject", orders:"All orders",
    noData:"No data yet", signout:"Sign out", backend:"Backend is not configured"
  }
};

function PixelIcon({kind}:{kind:"egg"|"meat"|"veg"|"extra"|"rice"|"ticket"|"chef"}){
  return <span className={"pixel-icon "+kind} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span>;
}

function Nav({view,setView,lang,setLang}:{view:View;setView:(v:View)=>void;lang:Lang;setLang:(l:Lang)=>void}){
  const t=copy[lang];
  const items:[View,string][]=[["home",t.home],["order",t.order],["apply",t.apply],["login",t.login],["member",t.member],["admin",t.admin]];
  return <nav className="nav">
    <div className="brand"><PixelIcon kind="egg"/><div><b>KAIJAOWINTER</b><small>PIXEL FOOD QUEST</small></div></div>
    <div className="nav-links">{items.map(([v,label])=><button key={v} className={view===v?"active":""} onClick={()=>setView(v)}>{label}</button>)}</div>
    <button className="lang" onClick={()=>setLang(lang==="th"?"en":"th")}>{lang==="th"?"EN":"ไทย"}</button>
  </nav>;
}

export default function Page(){
  const [lang,setLang]=useState<Lang>("th");
  const [view,setView]=useState<View>("home");
  const [tier,setTier]=useState<MenuTier>(MENU_TIERS[0]);
  const [selected,setSelected]=useState<string[]>([]);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [application,setApplication]=useState({email:"",phone:"",nickname:"",bio:""});
  const [loginPhone,setLoginPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [session,setSession]=useState<any>(null);
  const [profile,setProfile]=useState<any>(null);
  const [history,setHistory]=useState<any[]>([]);
  const [applications,setApplications]=useState<any[]>([]);
  const [adminOrders,setAdminOrders]=useState<any[]>([]);
  const supabase=useMemo(()=>getSupabase(),[]);
  const t=copy[lang];

  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[supabase]);

  useEffect(()=>{ if(session) loadMember(); },[session]);

  async function loadMember(){
    if(!supabase||!session) return;
    const {data:p}=await supabase.from("profiles").select("*").eq("user_id",session.user.id).maybeSingle();
    setProfile(p||null);
    const {data:o}=await supabase.from("orders").select("*,order_items(*)").eq("member_id",session.user.id).order("created_at",{ascending:false});
    setHistory(o||[]);
  }

  function toggle(code:string){
    setNotice("");
    setSelected(prev=>prev.includes(code)?prev.filter(x=>x!==code):prev.length<5?[...prev,code]:prev);
  }

  async function submitOrder(){
    if(selected.length!==5){setNotice(t.need5);return;}
    if(!supabase){setNotice(t.backend);return;}
    if(!session){setNotice(lang==="th"?"กรุณาเข้าสู่ระบบก่อนสั่ง":"Please login before ordering");setView("login");return;}
    setBusy(true); setNotice("");
    const {data,error}=await supabase.rpc("create_order",{p_menu_code:tier.code,p_topping_codes:selected});
    if(error) setNotice(error.message);
    else {setNotice(lang==="th"?`รับออเดอร์แล้ว #${data}`:`Order received #${data}`);setSelected([]);await loadMember();}
    setBusy(false);
  }

  async function submitApplication(){
    if(!supabase){setNotice(t.backend);return;}
    setBusy(true); setNotice("");
    const {error}=await supabase.from("member_applications").insert({
      email:application.email.trim().toLowerCase(),
      phone:application.phone.trim(),
      nickname:application.nickname.trim(),
      bio:application.bio.trim(),
      status:"pending"
    });
    setNotice(error?error.message:t.appSent);
    if(!error)setApplication({email:"",phone:"",nickname:"",bio:""});
    setBusy(false);
  }

  async function sendOtp(){
    if(!supabase){setNotice(t.backend);return;}
    setBusy(true); setNotice("");
    const {error}=await supabase.auth.signInWithOtp({phone:loginPhone,options:{shouldCreateUser:false}});
    setNotice(error?error.message:(lang==="th"?"ส่ง OTP แล้ว":"OTP sent"));
    setBusy(false);
  }

  async function verifyOtp(){
    if(!supabase){setNotice(t.backend);return;}
    setBusy(true); setNotice("");
    const {error}=await supabase.auth.verifyOtp({phone:loginPhone,token:otp,type:"sms"});
    setNotice(error?error.message:(lang==="th"?"เข้าสู่ระบบสำเร็จ":"Signed in"));
    if(!error)setView("member");
    setBusy(false);
  }

  async function saveProfile(){
    if(!supabase||!profile) return;
    const {error}=await supabase.from("profiles").update({nickname:profile.nickname,bio:profile.bio}).eq("user_id",profile.user_id);
    setNotice(error?error.message:(lang==="th"?"บันทึกแล้ว":"Saved"));
  }

  async function loadAdmin(){
    if(!supabase){setNotice(t.backend);return;}
    setBusy(true);
    const [a,o]=await Promise.all([
      supabase.from("member_applications").select("*").eq("status","pending").order("created_at"),
      supabase.from("orders").select("*,order_items(*)").order("created_at",{ascending:false}).limit(100)
    ]);
    setApplications(a.data||[]); setAdminOrders(o.data||[]);
    setNotice(a.error?.message||o.error?.message||"");
    setBusy(false);
  }

  async function decide(app:any,decision:"approved"|"rejected"){
    if(!supabase) return;
    setBusy(true); setNotice("");
    if(decision==="approved"){
      const {data,error}=await supabase.functions.invoke("approve-member",{body:{application_id:app.id}});
      setNotice(error?error.message:(data?.message||"Approved"));
    }else{
      const {error}=await supabase.from("member_applications").update({status:"rejected",decided_at:new Date().toISOString()}).eq("id",app.id);
      setNotice(error?error.message:"Rejected");
    }
    await loadAdmin(); setBusy(false);
  }

  const chosen=selected.map(c=>TOPPINGS.find(x=>x.code===c)).filter(Boolean);

  return <main>
    <Nav view={view} setView={setView} lang={lang} setLang={setLang}/>
    {!supabase && <div className="demo-banner">⚡ {t.demo}</div>}
    {notice && <div className="notice">{notice}</div>}

    {view==="home" && <section className="hero">
      <div className="hero-copy">
        <span className="badge">8-BIT FOOD • 16-BIT FUN</span>
        <h1>{t.title}</h1><p>{t.sub}</p>
        <div className="hero-actions"><button className="primary" onClick={()=>setView("order")}>{t.order}</button><button onClick={()=>setView("apply")}>{t.apply}</button></div>
        <div className="tier-strip">{MENU_TIERS.map(m=><div key={m.code}><b>{m.en}</b><strong>฿{m.price}</strong><small>{m.eggs} EGGS · 5 TOPPINGS</small></div>)}</div>
      </div>
      <div className="game-scene" aria-label="Original pixel food kitchen scene">
        <div className="cloud c1"/><div className="cloud c2"/><div className="sun"/>
        <div className="pixel-sign">KAIJAOWINTER</div>
        <div className="counter"><PixelIcon kind="chef"/><PixelIcon kind="egg"/><PixelIcon kind="rice"/><PixelIcon kind="veg"/><PixelIcon kind="meat"/></div>
        <div className="floor">{Array.from({length:24}).map((_,i)=><i key={i}/>)}</div>
      </div>
    </section>}

    {view==="order" && <section className="panel">
      <h2>{t.order}</h2>
      <h3>{t.pickTier}</h3>
      <div className="tier-grid">{MENU_TIERS.map(m=><button key={m.code} className={"tier-card "+(tier.code===m.code?"selected":"")} onClick={()=>setTier(m)}>
        <PixelIcon kind="egg"/><b>{lang==="th"?m.th:m.en}</b><strong>฿{m.price}</strong><small>{m.eggs} {lang==="th"?"ฟอง":"eggs"} · 5 toppings · {m.rice}g rice</small>
      </button>)}</div>
      <div className="section-title"><h3>{t.pickTop}</h3><span className="counter-chip">{t.selected} {selected.length}/5</span></div>
      <div className="topping-grid">{TOPPINGS.map(x=><button key={x.code} className={"topping "+(selected.includes(x.code)?"selected":"")} onClick={()=>toggle(x.code)}>
        <PixelIcon kind={x.category==="protein"?"meat":x.category==="veg"?"veg":"extra"}/><b>{lang==="th"?x.th:x.en}</b><small>{x.code}</small>
      </button>)}</div>
      <div className="order-review">
        <div><h3>{t.review}</h3><p><b>{tier.en} · ฿{tier.price}</b> · {tier.eggs} eggs · rice {tier.rice} g</p>
        <p>{chosen.map(x=>lang==="th"?x?.th:x?.en).join(" • ")||"—"}</p></div>
        <button disabled={busy||selected.length!==5} className="primary" onClick={submitOrder}>{busy?t.pending:t.submit}</button>
      </div>
    </section>}

    {view==="apply" && <section className="panel narrow"><h2>{t.applyTitle}</h2>
      <label>{t.email}<input value={application.email} type="email" onChange={e=>setApplication({...application,email:e.target.value})}/></label>
      <label>{t.phone}<input value={application.phone} onChange={e=>setApplication({...application,phone:e.target.value})} placeholder="+66..."/></label>
      <label>{t.nickname}<input value={application.nickname} onChange={e=>setApplication({...application,nickname:e.target.value})}/></label>
      <label>{t.bio}<textarea value={application.bio} maxLength={500} onChange={e=>setApplication({...application,bio:e.target.value})}/></label>
      <button className="primary" disabled={busy||!application.email||!application.phone||!application.nickname} onClick={submitApplication}>{busy?t.pending:t.sendApply}</button>
    </section>}

    {view==="login" && <section className="panel narrow"><h2>{t.loginTitle}</h2>
      <label>{t.phone}<input value={loginPhone} onChange={e=>setLoginPhone(e.target.value)} placeholder="+66..."/></label>
      <button onClick={sendOtp} disabled={busy||!loginPhone}>{t.sendOtp}</button>
      <label>{t.otp}<input value={otp} inputMode="numeric" maxLength={6} onChange={e=>setOtp(e.target.value.replace(/\D/g,""))}/></label>
      <button className="primary" onClick={verifyOtp} disabled={busy||otp.length<6}>{t.verify}</button>
    </section>}

    {view==="member" && <section className="panel">
      <div className="section-title"><h2>{t.member}</h2>{session&&<button onClick={async()=>{await supabase?.auth.signOut();setProfile(null);setHistory([]);}}>{t.signout}</button>}</div>
      {!session?<div className="empty"><PixelIcon kind="ticket"/><p>{lang==="th"?"กรุณาเข้าสู่ระบบ":"Please login"}</p><button onClick={()=>setView("login")}>{t.login}</button></div>:<>
      <div className="profile-card"><PixelIcon kind="chef"/><div className="grow">
        <label>{t.nickname}<input value={profile?.nickname||""} onChange={e=>setProfile({...profile,nickname:e.target.value})}/></label>
        <label>{t.bio}<textarea value={profile?.bio||""} onChange={e=>setProfile({...profile,bio:e.target.value})}/></label>
        <div className="status">STATUS: {profile?.membership_status||"—"}</div>
        <button onClick={saveProfile}>{t.save}</button>
      </div></div>
      <h3>{t.history}</h3><div className="list">{history.length?history.map(o=><article key={o.id}><b>#{o.order_no} · {o.menu_code} · ฿{o.total_thb}</b><span>{o.status}</span><small>{new Date(o.created_at).toLocaleString()}</small></article>):<p>{t.noData}</p>}</div>
      </>}
    </section>}

    {view==="admin" && <section className="panel">
      <div className="section-title"><h2>{t.admin}</h2><button onClick={loadAdmin} disabled={busy}>↻ {lang==="th"?"โหลดข้อมูล":"Refresh"}</button></div>
      <div className="admin-grid">
        <div><h3>{t.approvals}</h3><div className="list">{applications.length?applications.map(a=><article key={a.id}><b>{a.nickname}</b><span>{a.email} · {a.phone}</span><small>{a.bio}</small><div><button onClick={()=>decide(a,"approved")}>{t.approve}</button><button onClick={()=>decide(a,"rejected")}>{t.reject}</button></div></article>):<p>{t.noData}</p>}</div></div>
        <div><h3>{t.orders}</h3><div className="list">{adminOrders.length?adminOrders.map(o=><article key={o.id}><b>#{o.order_no} · {o.menu_code} · ฿{o.total_thb}</b><span>{o.status}</span><small>{o.member_id}</small></article>):<p>{t.noData}</p>}</div></div>
      </div>
    </section>}

    <footer>KAIJAOWINTER • ORIGINAL PIXEL FOOD SYSTEM • TH / EN</footer>
  </main>;
}
