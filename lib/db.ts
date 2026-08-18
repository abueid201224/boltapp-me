import type { InvoiceItem, ImportedRow } from '@/types';

const DB_NAME = 'invoice-verify-db';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function genId(invoice: string, item: string): string {
  return `${invoice}::${item}`;
}

export async function clearAllItems(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    tx.objectStore(STORE_ITEMS).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function importRows(rows: ImportedRow[]): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    store.clear();
    let count = 0;
    for (const row of rows) {
      const item: InvoiceItem = {
        id: genId(String(row.Invoice_Code).trim(), String(row.Item_Code).trim()),
        invoice_code: String(row.Invoice_Code).trim(),
        item_code: String(row.Item_Code).trim(),
        item_description: String(row.Item_Description ?? '').trim(),
        unit: String(row.Unit ?? '').trim(),
        target_quantity: Number(row.Target_Quantity) || 0,
        scanned_count: 0,
      };
      store.put(item);
      count++;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(count);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllItems(): Promise<InvoiceItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readonly');
    const req = tx.objectStore(STORE_ITEMS).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result as InvoiceItem[]);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getInvoiceItems(invoiceCode: string): Promise<InvoiceItem[]> {
  const all = await getAllItems();
  return all.filter((i) => i.invoice_code === invoiceCode);
}

export async function getAllInvoiceCodes(): Promise<string[]> {
  const all = await getAllItems();
  return [...new Set(all.map((i) => i.invoice_code))].sort();
}

export async function incrementScan(invoiceCode: string, itemCode: string): Promise<InvoiceItem | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    const id = genId(invoiceCode, itemCode);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as InvoiceItem | undefined;
      if (!item) {
        db.close();
        resolve(null);
        return;
      }
      item.scanned_count += 1;
      store.put(item);
    };
    tx.oncomplete = () => {
      db.close();
      const finalReq = openDB().then((db2) => {
        const tx2 = db2.transaction(STORE_ITEMS, 'readonly');
        const r = tx2.objectStore(STORE_ITEMS).get(id);
        r.onsuccess = () => {
          db2.close();
          resolve(r.result as InvoiceItem);
        };
        r.onerror = () => reject(r.error);
      });
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function resetScannedCount(invoiceCode: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result as InvoiceItem[];
      for (const item of items) {
        if (item.invoice_code === invoiceCode) {
          item.scanned_count = 0;
          store.put(item);
        }
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateItem(item: InvoiceItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    tx.objectStore(STORE_ITEMS).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getItemCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ITEMS, 'readonly');
    const req = tx.objectStore(STORE_ITEMS).count();
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}
