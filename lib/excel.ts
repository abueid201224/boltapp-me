import * as XLSX from 'xlsx';
import type { ImportedRow } from '@/types';

const COLUMN_ALIASES: Record<keyof ImportedRow, string[]> = {
  Invoice_Code: ['Invoice_Code', 'Invoice Code', 'InvoiceCode', 'كود الفاتورة', 'invoice_code'],
  Item_Code: ['Item_Code', 'Item Code', 'ItemCode', 'كود الصنف', 'item_code'],
  Item_Description: ['Item_Description', 'Item Description', 'ItemDescription', 'بيان الصنف', 'item_description'],
  Unit: ['Unit', 'الوحدة', 'unit'],
  Target_Quantity: ['Target_Quantity', 'Target Quantity', 'TargetQuantity', 'الكمية المطلوبة', 'target_quantity'],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_]+/g, '');
}

function findColumn(
  row: Record<string, unknown>,
  aliases: string[]
): unknown {
  const normalizedAliases = aliases.map(normalizeKey);
  const keys = Object.keys(row);
  for (const alias of normalizedAliases) {
    const match = keys.find((k) => normalizeKey(k) === alias);
    if (match) return row[match];
  }
  for (const alias of normalizedAliases) {
    const match = keys.find((k) => normalizeKey(k).includes(alias) || alias.includes(normalizeKey(k)));
    if (match) return row[match];
  }
  return undefined;
}

export async function parseExcelFile(file: File): Promise<ImportedRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows: ImportedRow[] = [];
  for (const rawRow of json) {
    const invoiceCode = findColumn(rawRow, COLUMN_ALIASES.Invoice_Code);
    const itemCode = findColumn(rawRow, COLUMN_ALIASES.Item_Code);

    if (!invoiceCode && !itemCode) continue;

    const row: ImportedRow = {
      Invoice_Code: String(invoiceCode ?? '').trim(),
      Item_Code: String(itemCode ?? '').trim(),
      Item_Description: String(findColumn(rawRow, COLUMN_ALIASES.Item_Description) ?? '').trim(),
      Unit: String(findColumn(rawRow, COLUMN_ALIASES.Unit) ?? '').trim(),
      Target_Quantity: Number(findColumn(rawRow, COLUMN_ALIASES.Target_Quantity)) || 0,
    };

    if (row.Invoice_Code && row.Item_Code) {
      rows.push(row);
    }
  }
  return rows;
}
