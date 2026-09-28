/**
 * Shtutnik · orders → Google Sheet
 *
 * Setup:
 *   1. In the target Google Sheet: Extensions → Apps Script, paste this file.
 *   2. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone        (otherwise the browser fails on CORS)
 *   3. Copy the /exec URL into SHEET_URL in index.html.
 *   After every code change: Deploy → Manage deployments → Edit → New version
 *   (the /exec URL stays the same).
 *
 * Contract with index.html:
 *   - Body is JSON sent as text/plain (no CORS preflight).
 *   - Responds {ok:true} only after the row is written. The site redirects to
 *     Selector only after it sees ok:true.
 *   - Upserts by orderId: a retry after a timeout updates the same row
 *     instead of creating a duplicate order.
 */

var SHEET_NAME = 'Orders';   // fallback when the request has no sheetName
var HEADERS = [
  'orderId', 'updatedAt', 'name', 'phone', 'details', 'quantity',
  'shirtCount', 'hoodieCount', 'shirtsPrice', 'hoodiesPrice', 'totalPrice',
  'paymentLink', 'items', 'paid'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!data.orderId || !data.name) return json_({ ok: false, error: 'missing orderId/name' });

    var sheet = getSheet_(data.sheetName || SHEET_NAME);   // e.g. 'שנות ה80'
    var row = [
      data.orderId, new Date(), data.name, asText_(data.phone), data.details, data.quantity,
      data.shirtCount, data.hoodieCount, data.shirtsPrice, data.hoodiesPrice, data.totalPrice,
      data.paymentLink, data.items
    ].map(safe_);

    var existing = findRow_(sheet, data.orderId);
    var target = existing || sheet.getLastRow() + 1;
    var range = sheet.getRange(target, 1, 1, row.length);
    range.setValues([row]);
    sheet.getRange(target, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');

    return json_({ ok: true, orderId: data.orderId, updated: !!existing });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Health check: open the /exec URL in a browser and expect {"ok":true,...}
function doGet() {
  return json_({ ok: true, service: 'shtutnik-orders' });
}

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function findRow_(sheet, orderId) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var hit = sheet.getRange(2, 1, last - 1, 1).createTextFinder(String(orderId)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

// Strings starting with = + - @ would run as formulas in the sheet. Prefix them.
function safe_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && v.charAt(0) !== "'" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

// Leading apostrophe = store as text, so 0501234567 keeps its leading zero.
function asText_(v) {
  return v ? "'" + String(v) : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
