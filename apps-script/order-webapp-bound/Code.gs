const ORDER_SHEET_NAME = '\u5BA2\u6236\u55AE';
const ORDER_SPREADSHEET_ID = '1H7rhWYzcl7-VsHpaGTIyaF7LeVlZpOP6ed3Eeub8AOg';
const ORDER_HEADERS = [
  '\u4E0B\u55AE\u6642\u9593',
  '\u8CFC\u8CB7\u5546\u54C1\u5305\u542B\u7DE8\u865F',
  '\u4E0B\u55AE\u6578\u91CF',
  '\u96FB\u5B50\u90F5\u4EF6\u4FE1\u7BB1',
  '\u806F\u7D61\u96FB\u8A71',
  '\u806F\u7D61\u4EBA\u59D3\u540D',
  '\u53D6\u8CA8\u8D85\u5546',
  '\u9580\u5E02\u540D\u7A31',
  '\u9580\u5E02\u5E97\u865F',
  '\u8A02\u55AE\u662F\u5426\u5DF2\u8655\u7406'
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
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim();
    const phone = String(payload.phone || '').trim();
    const pickupStore = String(payload.pickupStore || '').trim();
    const storeName = String(payload.storeName || '').trim();
    const storeCode = String(payload.storeCode || '').trim();
    const items = parseItems_(payload.items);

    if (!name) {
      return jsonResponse_({ ok: false, error: 'Name is required.' });
    }

    if (!isValidEmail_(email)) {
      return jsonResponse_({ ok: false, error: 'Invalid email.' });
    }

    if (!isValidPhone_(phone)) {
      return jsonResponse_({ ok: false, error: 'Invalid phone.' });
    }

    if (!['全家', '7-11'].includes(pickupStore)) {
      return jsonResponse_({ ok: false, error: 'Invalid pickup store.' });
    }

    if (!storeName) {
      return jsonResponse_({ ok: false, error: 'Store name is required.' });
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
        email,
        phone,
        name,
        pickupStore,
        storeName,
        storeCode,
        '\u5426'
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
  const spreadsheet = SpreadsheetApp.openById(ORDER_SPREADSHEET_ID);
  return spreadsheet.getSheetByName(ORDER_SHEET_NAME) || spreadsheet.insertSheet(ORDER_SHEET_NAME);
}

function ensureOrderHeaders_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, ORDER_HEADERS.length).getValues()[0];
  const needsHeader = ORDER_HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const statusRange = sheet.getRange(2, ORDER_HEADERS.length, lastRow - 1, 1);
    const statuses = statusRange.getValues();
    let changed = false;
    statuses.forEach(row => {
      if (!String(row[0] || '').trim()) {
        row[0] = '\u5426';
        changed = true;
      }
    });
    if (changed) {
      statusRange.setValues(statuses);
    }
  }
}

function getPendingOrderCount_() {
  const sheet = getOrderSheet_();
  ensureOrderHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return 0;
  }

  const statuses = sheet.getRange(2, ORDER_HEADERS.length, lastRow - 1, 1).getDisplayValues();
  return statuses.reduce((count, row) => count + (row[0] === '\u662F' ? 0 : 1), 0);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone_(phone) {
  return /^[0-9+()\-\s]{8,20}$/.test(phone);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
