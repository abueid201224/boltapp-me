import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ScanLine,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  ChevronDown,
  Search,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react-native';
import {
  getInvoiceItems,
  getAllInvoiceCodes,
  incrementScan,
  resetScannedCount,
  getAllItems,
} from '@/lib/db';
import type { InvoiceItem, EvaluatedItem, QuantityStatus } from '@/types';

const DARK_BG = '#0F172A';
const CARD_BG = '#1E293B';
const CARD_BG_LIGHT = '#334155';
const PRIMARY = '#3B82F6';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const ERROR = '#EF4444';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#94A3B8';
const BORDER = '#334155';

function getQuantityStatus(scanned: number, target: number): QuantityStatus {
  if (target === 0) return 'بانتظار';
  if (scanned === 0) return 'ناقص';
  if (scanned < target) return 'ناقص';
  if (scanned === target) return 'تمام';
  return 'زيادة';
}

function StatusBadge({ status }: { status: QuantityStatus }) {
  const config: Record<QuantityStatus, { bg: string; text: string }> = {
    'ناقص': { bg: 'rgba(239,68,68,0.15)', text: ERROR },
    'تمام': { bg: 'rgba(16,185,129,0.15)', text: SUCCESS },
    'زيادة': { bg: 'rgba(245,158,11,0.15)', text: WARNING },
    'بانتظار': { bg: 'rgba(148,163,184,0.15)', text: TEXT_SECONDARY },
  };
  const c = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

export default function VerificationScreen() {
  const [invoiceCodes, setInvoiceCodes] = useState<string[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>('');
  const [invoiceInput, setInvoiceInput] = useState<string>('');
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [unknownItems, setUnknownItems] = useState<{ code: string; count: number }[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const scanInputRef = useRef<TextInput>(null);

  const loadInvoiceCodes = useCallback(async () => {
    const codes = await getAllInvoiceCodes();
    setInvoiceCodes(codes);
  }, []);

  useEffect(() => {
    (async () => {
      await loadInvoiceCodes();
      setLoading(false);
    })();
  }, [loadInvoiceCodes]);

  const loadInvoice = useCallback(async (code: string) => {
    if (!code.trim()) return;
    const invoiceItems = await getInvoiceItems(code.trim());
    setItems(invoiceItems);
    setUnknownItems([]);
    setLastScannedCode('');
    setFlash(null);
  }, []);

  const handleSelectInvoice = useCallback(
    async (code: string) => {
      setSelectedInvoice(code);
      setInvoiceInput(code);
      setShowInvoiceDropdown(false);
      await loadInvoice(code);
      setTimeout(() => scanInputRef.current?.focus(), 100);
    },
    [loadInvoice],
  );

  const handleInvoiceSubmit = useCallback(async () => {
    if (!invoiceInput.trim()) return;
    const code = invoiceInput.trim();
    const exists = invoiceCodes.includes(code);
    if (!exists) {
      const allCodes = await getAllInvoiceCodes();
      if (!allCodes.includes(code)) {
        Alert.alert('تنبيه', `كود الفاتورة "${code}" غير موجود في قاعدة البيانات`, [{ text: 'حسناً' }]);
        return;
      }
      setInvoiceCodes(allCodes);
    }
    await handleSelectInvoice(code);
  }, [invoiceInput, invoiceCodes, handleSelectInvoice]);

  const handleScanSubmit = useCallback(async () => {
    const code = scanInput.trim();
    if (!code || !selectedInvoice) {
      setScanInput('');
      return;
    }

    const updated = await incrementScan(selectedInvoice, code);
    if (updated) {
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setLastScannedCode(code);
      setFlash('success');
    } else {
      setUnknownItems((prev) => {
        const existing = prev.find((u) => u.code === code);
        if (existing) {
          return prev.map((u) => (u.code === code ? { ...u, count: u.count + 1 } : u));
        }
        return [...prev, { code, count: 1 }];
      });
      setLastScannedCode(code);
      setFlash('error');
    }
    setScanInput('');
    setTimeout(() => setFlash(null), 600);
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [scanInput, selectedInvoice]);

  const handleReset = useCallback(async () => {
    if (!selectedInvoice) return;
    Alert.alert(
      'تأكيد إعادة التعيين',
      'سيتم تصفير جميع الكميات الممسوكة للفاتورة الحالية. هل أنت متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إعادة تعيين',
          style: 'destructive',
          onPress: async () => {
            await resetScannedCount(selectedInvoice);
            await loadInvoice(selectedInvoice);
          },
        },
      ],
    );
  }, [selectedInvoice, loadInvoice]);

  const handleNewInvoice = useCallback(() => {
    Alert.alert(
      'فاتورة جديدة',
      'سيتم مسح جميع البيانات الممسوكة للفاتورة الحالية. هل تريد المتابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'فاتورة جديدة',
          style: 'destructive',
          onPress: async () => {
            if (selectedInvoice) {
              await resetScannedCount(selectedInvoice);
            }
            setSelectedInvoice('');
            setInvoiceInput('');
            setItems([]);
            setUnknownItems([]);
            setScanInput('');
            setLastScannedCode('');
            await loadInvoiceCodes();
          },
        },
      ],
    );
  }, [selectedInvoice, loadInvoiceCodes]);

  const evaluatedItems: EvaluatedItem[] = useMemo(() => {
    return items.map((item) => ({
      ...item,
      code_match: 'مطابق' as const,
      quantity_status: getQuantityStatus(item.scanned_count, item.target_quantity),
      is_unknown: false,
    }));
  }, [items]);

  const unknownEvaluated: EvaluatedItem[] = useMemo(() => {
    return unknownItems.map((u) => ({
      id: `unknown::${u.code}`,
      invoice_code: selectedInvoice,
      item_code: u.code,
      item_description: 'صنف غير موجود في الفاتورة',
      unit: '-',
      target_quantity: 0,
      scanned_count: u.count,
      code_match: 'غير مطابق' as const,
      quantity_status: 'زيادة' as const,
      is_unknown: true,
    }));
  }, [unknownItems, selectedInvoice]);

  const allEvaluated = [...evaluatedItems, ...unknownEvaluated];

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.scanned_count === i.target_quantity && i.target_quantity > 0).length;
    const incomplete = items.filter((i) => i.scanned_count < i.target_quantity).length;
    const over = items.filter((i) => i.scanned_count > i.target_quantity).length;
    const unknown = unknownItems.length;
    const totalScanned = items.reduce((sum, i) => sum + i.scanned_count, 0) + unknownItems.reduce((s, u) => s + u.count, 0);
    const totalTarget = items.reduce((sum, i) => sum + i.target_quantity, 0);
    const progress = totalTarget > 0 ? Math.min(100, Math.round((totalScanned / totalTarget) * 100)) : 0;
    return { total, completed, incomplete, over, unknown, totalScanned, totalTarget, progress };
  }, [items, unknownItems]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <ScanLine color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.headerTitle}>مراجعة الفواتير</Text>
            <Text style={styles.headerSubtitle}>نظام التحقق بالماسح الضوئي</Text>
          </View>
        </View>
        <Pressable style={styles.newInvoiceBtn} onPress={handleNewInvoice}>
          <RotateCcw color="#F1F5F9" size={16} strokeWidth={2} />
          <Text style={styles.newInvoiceBtnText}>فاتورة جديدة</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Invoice Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>كود الفاتورة</Text>
          <View style={styles.invoiceSelectorRow}>
            <View style={styles.invoiceInputWrap}>
              <TextInput
                style={styles.invoiceInput}
                value={invoiceInput}
                onChangeText={setInvoiceInput}
                placeholder="اختر أو امسح كود الفاتورة"
                placeholderTextColor={TEXT_SECONDARY}
                textAlign="right"
                onSubmitEditing={handleInvoiceSubmit}
                returnKeyType="go"
              />
              <Pressable
                style={styles.dropdownBtn}
                onPress={() => setShowInvoiceDropdown((v) => !v)}
              >
                <ChevronDown color={TEXT_SECONDARY} size={20} strokeWidth={2} />
              </Pressable>
            </View>
            <Pressable style={styles.loadBtn} onPress={handleInvoiceSubmit}>
              <Search color="#FFFFFF" size={18} strokeWidth={2.5} />
              <Text style={styles.loadBtnText}>تحميل</Text>
            </Pressable>
          </View>

          {showInvoiceDropdown && invoiceCodes.length > 0 && (
            <View style={styles.dropdown}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {invoiceCodes.map((code) => (
                  <Pressable
                    key={code}
                    style={[
                      styles.dropdownItem,
                      code === selectedInvoice && styles.dropdownItemActive,
                    ]}
                    onPress={() => handleSelectInvoice(code)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        code === selectedInvoice && styles.dropdownItemTextActive,
                      ]}
                    >
                      {code}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {invoiceCodes.length === 0 && (
            <View style={styles.emptyHint}>
              <FileSpreadsheet color={TEXT_SECONDARY} size={20} strokeWidth={2} />
              <Text style={styles.emptyHintText}>
                لا توجد بيانات. انتقل إلى تبويب البيانات لرفع ملف Excel.
              </Text>
            </View>
          )}
        </View>

        {selectedInvoice ? (
          <>
            {/* Scanner Input */}
            <View style={[styles.section, styles.scannerSection, flash === 'success' && styles.scannerFlashSuccess, flash === 'error' && styles.scannerFlashError]}>
              <View style={styles.scannerHeader}>
                <ScanLine color={PRIMARY} size={20} strokeWidth={2.5} />
                <Text style={styles.scannerLabel}>امسح كود الصنف</Text>
              </View>
              <TextInput
                ref={scanInputRef}
                style={styles.scanInput}
                value={scanInput}
                onChangeText={setScanInput}
                placeholder="في انتظار المسح..."
                placeholderTextColor={TEXT_SECONDARY}
                textAlign="center"
                autoFocus
                onSubmitEditing={handleScanSubmit}
                returnKeyType="go"
                selectTextOnFocus
              />
              {lastScannedCode ? (
                <View style={styles.lastScanRow}>
                  <Text style={styles.lastScanLabel}>آخر ماسح: </Text>
                  <Text
                    style={[
                      styles.lastScanValue,
                      flash === 'error' && { color: ERROR },
                      flash === 'success' && { color: SUCCESS },
                    ]}
                  >
                    {lastScannedCode}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Reset Button */}
            <Pressable style={styles.resetBtn} onPress={handleReset}>
              <RotateCcw color="#F1F5F9" size={16} strokeWidth={2} />
              <Text style={styles.resetBtnText}>تصفير الكميات الممسوكة</Text>
            </Pressable>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Package color={PRIMARY} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>إجمالي الأصناف</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  <CheckCircle2 color={SUCCESS} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>مكتمل</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <XCircle color={ERROR} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{stats.incomplete}</Text>
                <Text style={styles.statLabel}>ناقص</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <AlertTriangle color={WARNING} size={18} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{stats.unknown}</Text>
                <Text style={styles.statLabel}>غير مطابق</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLeft}>
                  <TrendingUp color={PRIMARY} size={16} strokeWidth={2.5} />
                  <Text style={styles.progressLabel}>التقدم الإجمالي</Text>
                </View>
                <Text style={styles.progressValue}>
                  {stats.totalScanned} / {stats.totalTarget} ({stats.progress}%)
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${stats.progress}%`,
                      backgroundColor: stats.progress === 100 ? SUCCESS : PRIMARY,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Evaluation Table */}
            <View style={styles.tableSection}>
              <Text style={styles.tableTitle}>جدول المراجعة المباشر</Text>
              {allEvaluated.length === 0 ? (
                <View style={styles.emptyTable}>
                  <Package color={TEXT_SECONDARY} size={32} strokeWidth={1.5} />
                  <Text style={styles.emptyTableText}>لا توجد أصناف في هذه الفاتورة</Text>
                </View>
              ) : (
                <View style={styles.table}>
                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>كود الصنف</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>البيان</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>الوحدة</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'center' }]}>مطلوب</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'center' }]}>ممسوح</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>الكود</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>الكمية</Text>
                  </View>
                  {/* Table Rows */}
                  {allEvaluated.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.tableRow,
                        item.is_unknown && styles.unknownRow,
                        lastScannedCode === item.item_code && styles.lastScannedRow,
                      ]}
                    >
                      <Text
                        style={[styles.tableCell, { flex: 1.2 }, item.is_unknown && styles.unknownCell]}
                        numberOfLines={1}
                      >
                        {item.item_code}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={2}>
                        {item.item_description}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 0.8 }]} numberOfLines={1}>
                        {item.unit}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center' }]}>
                        {item.target_quantity}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { flex: 0.7, textAlign: 'center' },
                          item.scanned_count > 0 && { color: PRIMARY, fontFamily: 'Cairo-Bold' },
                        ]}
                      >
                        {item.scanned_count}
                      </Text>
                      <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center' }]}>
                        <View
                          style={[
                            styles.codeBadge,
                            {
                              backgroundColor: item.code_match === 'مطابق'
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(239,68,68,0.15)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.codeBadgeText,
                              { color: item.code_match === 'مطابق' ? SUCCESS : ERROR },
                            ]}
                          >
                            {item.code_match}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center' }]}>
                        <StatusBadge status={item.quantity_status} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.welcomeSection}>
            <View style={styles.welcomeIcon}>
              <ScanLine color={PRIMARY} size={48} strokeWidth={1.5} />
            </View>
            <Text style={styles.welcomeTitle}>اختر فاتورة للبدء</Text>
            <Text style={styles.welcomeText}>
              اختر كود الفاتورة من القائمة المنسدلة أو امسحه بالماسح الضوئي لبدء عملية المراجعة
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingTop: Platform.OS === 'web' ? 14 : 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
  },
  headerSubtitle: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  newInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  newInvoiceBtnText: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionLabel: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
    marginBottom: 10,
  },
  invoiceSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  invoiceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  invoiceInput: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: 'Cairo-SemiBold',
  },
  dropdownBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  loadBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
    fontSize: 14,
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  dropdownItemText: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 14,
  },
  dropdownItemTextActive: {
    color: PRIMARY,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  emptyHintText: {
    color: WARNING,
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    flex: 1,
  },
  scannerSection: {
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  scannerFlashSuccess: {
    borderColor: SUCCESS,
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  scannerFlashError: {
    borderColor: ERROR,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  scannerLabel: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 15,
  },
  scanInput: {
    backgroundColor: '#0F172A',
    color: TEXT_PRIMARY,
    fontSize: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    fontFamily: 'Cairo-Bold',
  },
  lastScanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'center',
  },
  lastScanLabel: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
  },
  lastScanValue: {
    color: PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 14,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CARD_BG,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  resetBtnText: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 22,
  },
  statLabel: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  progressSection: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressLabel: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
  },
  progressValue: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  tableSection: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tableTitle: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 15,
    marginBottom: 12,
  },
  emptyTable: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyTableText: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
  },
  table: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0B1120',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderCell: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 11,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51,65,85,0.5)',
    alignItems: 'center',
  },
  unknownRow: {
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  lastScannedRow: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  tableCell: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    paddingHorizontal: 4,
  },
  unknownCell: {
    color: ERROR,
    fontFamily: 'Cairo-Bold',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontFamily: 'Cairo-SemiBold',
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'Cairo-SemiBold',
    fontSize: 11,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  welcomeIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  welcomeTitle: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 20,
  },
  welcomeText: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
});
