const ORDER_SHEET_NAME = '\u5BA2\u6236\u55AE';
const ORDER_HEADERS = [
  '\u4E0B\u55AE\u6642\u9593',
  '\u8CFC\u8CB7\u5546\u54C1\u5305\u542B\u7DE8\u865F',
  '\u4E0B\u55AE\u6578\u91CF',
  '\u96FB\u5B50\u90F5\u4EF6\u4FE1\u7BB1'
];
const MAX_ORDER_QUANTITY = 20;

function doGet() {
  const pendingOrderCount = getPendingOrderCount_();
  return jsonResponse_({
    ok: true,
    service: 'emily-order-webapp',
    orderCount: pendingOrderCount,
    pendingOrderCount
  });
}

function doPost(e) {
  try {
    const payload = parseOrderPayload_(e);
    const email = String(payload.email || '').trim();
    const items = parseItems_(payload.items);

    if (!isValidEmail_(email)) {
      return jsonResponse_({ ok: false, error: 'Invalid email.' });
    }

    if (String(payload.website || '').trim()) {
      return jsonResponse_({ ok: false, error: 'Spam check failed.' });
    }

    const normalizedItems = items.map(normalizeOrderItem_).filter(Boolean);
    if (!normalizedItems.length) {
      return jsonResponse_({ ok: false, error: 'No valid cart items.' });
    }

    const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity < 1 || totalQuantity > MAX_ORDER_QUANTITY) {
      return jsonResponse_({
        ok: false,
        error: `Order quantity must be between 1 and ${MAX_ORDER_QUANTITY}.`
      });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      const sheet = getOrderSheet_();
      ensureOrderHeaders_(sheet);
      sheet.appendRow([
        new Date(),
        formatOrderItems_(normalizedItems),
        totalQuantity,
        email
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function parseOrderPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const type = String(e.postData.type || '').toLowerCase();
  const contents = String(e.postData.contents || '').trim();

  if (type.indexOf('application/json') !== -1 || contents.charAt(0) === '{') {
    return JSON.parse(e.postData.contents);
  }

  return e.parameter || {};
}

function parseItems_(items) {
  if (Array.isArray(items)) {
    return items;
  }

  if (typeof items === 'string' && items.trim()) {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function normalizeOrderItem_(item) {
  if (!item) {
    return null;
  }

  const name = String(item.name || '').trim();
  const code = String(item.code || '').trim();
  const quantity = Number(item.quantity || item.qty || 1);

  if (!name || !isFinite(quantity) || quantity < 1) {
    return null;
  }

  return {
    name,
    code,
    quantity: Math.floor(quantity)
  };
}

function formatOrderItems_(items) {
  return items.map(item => {
    const codePrefix = item.code ? `${item.code} ` : '';
    return `${codePrefix}${item.name} x ${item.quantity}`;
  }).join('\n');
}

function getOrderSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(ORDER_SHEET_NAME) || spreadsheet.insertSheet(ORDER_SHEET_NAME);
}

function ensureOrderHeaders_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, ORDER_HEADERS.length).getValues()[0];
  const needsHeader = ORDER_HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (!needsHeader) {
    return;
  }

  sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
  sheet.setFrozenRows(1);
}

function getPendingOrderCount_() {
  const sheet = getOrderSheet_();
  ensureOrderHeaders_(sheet);
  return Math.max(0, sheet.getLastRow() - 1);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
