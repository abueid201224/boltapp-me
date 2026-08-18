export interface InvoiceItem {
  id: string;
  invoice_code: string;
  item_code: string;
  item_description: string;
  unit: string;
  target_quantity: number;
  scanned_count: number;
}

export interface ImportedRow {
  Invoice_Code: string;
  Item_Code: string;
  Item_Description: string;
  Unit: string;
  Target_Quantity: number;
}

export type CodeMatchStatus = 'مطابق' | 'غير مطابق';
export type QuantityStatus = 'ناقص' | 'تمام' | 'زيادة' | 'بانتظار';

export interface EvaluatedItem extends InvoiceItem {
  code_match: CodeMatchStatus;
  quantity_status: QuantityStatus;
  is_unknown: boolean;
}
