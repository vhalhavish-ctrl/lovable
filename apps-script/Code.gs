const PROP = PropertiesService.getScriptProperties();

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const expected = PROP.getProperty("SYNC_SHARED_SECRET");
    if (!expected || body.secret !== expected) return json_({ ok:false, error:"INVALID_SECRET" }, 401);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const map = { profiles:"MEMBERS", orders:"ORDERS", toppings:"TOPPINGS_50" };
    const tab = map[body.entity];
    if (!tab) return json_({ ok:false, error:"ENTITY_NOT_ALLOWED" }, 400);
    upsertRecord_(ss.getSheetByName(tab), body.record);
    return json_({ ok:true }, 200);
  } catch (err) {
    return json_({ ok:false, error:String(err) }, 500);
  }
}

function installTwoWaySync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "syncEditToSupabase") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncEditToSupabase").forSpreadsheet(ss).onEdit().create();
  SpreadsheetApp.getUi().alert("KAIJAOWINTER two-way sync trigger installed.");
}

function syncEditToSupabase(e) {
  const sheet = e.range.getSheet();
  const allowedTabs = ["ORDERS","TOPPINGS_50","MEMBERS"];
  if (!allowedTabs.includes(sheet.getName()) || e.range.getRow() === 1) return;

  const functionUrl = PROP.getProperty("SUPABASE_SYNC_FUNCTION_URL");
  const secret = PROP.getProperty("SYNC_SHARED_SECRET");
  if (!functionUrl || !secret) return;

  const headers = headerMap_(sheet);
  const values = sheet.getRange(e.range.getRow(),1,1,sheet.getLastColumn()).getValues()[0];
  const row = {};
  Object.keys(headers).forEach(k => row[k] = values[headers[k]-1]);

  let entity, record;
  if (sheet.getName() === "ORDERS") {
    entity = "orders";
    record = { id:row.order_id, status:row.status, notes:row.notes, sync_version:Number(row.sync_version||0) };
  } else if (sheet.getName() === "TOPPINGS_50") {
    entity = "toppings";
    record = { code:row.topping_code, active:toBool_(row.active) };
  } else {
    entity = "profiles";
    record = { user_id:row.auth_user_id, nickname:row.nickname, bio:row.bio, sync_version:Number(row.sync_version||0) };
  }

  UrlFetchApp.fetch(functionUrl, {
    method:"post", contentType:"application/json", muteHttpExceptions:true,
    headers:{ "x-sync-secret": secret },
    payload:JSON.stringify({ entity, record })
  });
}

function upsertRecord_(sheet, record) {
  if (!sheet) throw new Error("SHEET_NOT_FOUND");
  const headers = headerMap_(sheet);
  const keyCandidates = ["id","user_id","code","order_id","auth_user_id","topping_code"];
  let sheetKey = keyCandidates.find(k => headers[k]);
  let recordKey = sheetKey;
  if (sheet.getName()==="MEMBERS") { sheetKey="auth_user_id"; recordKey="user_id"; }
  if (sheet.getName()==="ORDERS") { sheetKey="order_id"; recordKey="id"; }
  if (sheet.getName()==="TOPPINGS_50") { sheetKey="topping_code"; recordKey="code"; }
  if (!sheetKey || record[recordKey] == null) throw new Error("PRIMARY_KEY_NOT_FOUND");

  const keyCol = headers[sheetKey];
  const keyValue = String(record[recordKey]);
  const last = Math.max(sheet.getLastRow(),1);
  const values = last > 1 ? sheet.getRange(2,keyCol,last-1,1).getDisplayValues().flat() : [];
  const idx = values.findIndex(v => String(v) === keyValue);
  const targetRow = idx >= 0 ? idx+2 : last+1;

  Object.keys(headers).forEach(h => {
    let source = h;
    if (sheet.getName()==="MEMBERS" && h==="auth_user_id") source="user_id";
    if (sheet.getName()==="ORDERS" && h==="order_id") source="id";
    if (sheet.getName()==="TOPPINGS_50" && h==="topping_code") source="code";
    if (Object.prototype.hasOwnProperty.call(record, source)) sheet.getRange(targetRow,headers[h]).setValue(record[source]);
  });
}

function headerMap_(sheet) {
  const row = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const out = {}; row.forEach((v,i) => { if (v) out[String(v)] = i+1; }); return out;
}
function toBool_(v) { return v===true || String(v).toLowerCase()==="true" || String(v)==="1"; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
