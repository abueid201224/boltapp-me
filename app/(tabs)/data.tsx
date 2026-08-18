import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  Upload,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Trash2,
  Info,
  Package,
  Receipt,
} from 'lucide-react-native';
import { parseExcelFile } from '@/lib/excel';
import { importRows, getAllItems, getAllInvoiceCodes, getItemCount, clearAllItems } from '@/lib/db';
import type { ImportedRow } from '@/types';

const DARK_BG = '#0F172A';
const CARD_BG = '#1E293B';
const PRIMARY = '#3B82F6';
const SUCCESS = '#10B981';
const ERROR = '#EF4444';
const WARNING = '#F59E0B';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#94A3B8';
const BORDER = '#334155';

interface Notification {
  type: 'success' | 'error';
  message: string;
}

export default function DataScreen() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(async () => {
    const [count, codes] = await Promise.all([getItemCount(), getAllInvoiceCodes()]);
    setItemCount(count);
    setInvoiceCount(codes.length);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshStats();
      setLoading(false);
    })();
  }, [refreshStats]);

  const handleFileSelect = useCallback(() => {
    if (Platform.OS !== 'web') return;
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setImporting(true);
      setNotification(null);

      try {
        const rows = await parseExcelFile(file);
        if (rows.length === 0) {
          setNotification({
            type: 'error',
            message: 'لم يتم العثور على بيانات صالحة في الملف. تأكد من وجود الأعمدة المطلوبة.',
          });
          setImporting(false);
          return;
        }

        const importedCount = await importRows(rows);
        await refreshStats();
        setNotification({
          type: 'success',
          message: `تم تحديث قاعدة البيانات بنجاح — تم استيراد ${importedCount} صف`,
        });
      } catch (err) {
        setNotification({
          type: 'error',
          message: 'حدث خطأ أثناء قراءة الملف. تأكد من صحة التنسيق.',
        });
      } finally {
        setImporting(false);
        if (event.target) event.target.value = '';
      }
    },
    [refreshStats],
  );

  const handleClearData = useCallback(() => {
    Alert.alert(
      'تأكيد حذف البيانات',
      'سيتم حذف جميع بيانات الفواتير نهائياً. هل أنت متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الكل',
          style: 'destructive',
          onPress: async () => {
            await clearAllItems();
            await refreshStats();
            setNotification({ type: 'success', message: 'تم حذف جميع البيانات' });
          },
        },
      ],
    );
  }, [refreshStats]);

  const expectedColumns: { key: string; label: string }[] = [
    { key: 'Invoice_Code', label: 'كود الفاتورة' },
    { key: 'Item_Code', label: 'كود الصنف' },
    { key: 'Item_Description', label: 'بيان الصنف' },
    { key: 'Unit', label: 'الوحدة' },
    { key: 'Target_Quantity', label: 'الكمية المطلوبة' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Database color="#FFFFFF" size={22} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.headerTitle}>إدارة البيانات</Text>
            <Text style={styles.headerSubtitle}>رفع وتحديث قاعدة بيانات الفواتير</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Upload Button */}
        <Pressable
          style={[styles.uploadCard, importing && styles.uploadCardDisabled]}
          onPress={handleFileSelect}
          disabled={importing}
        >
          {importing ? (
            <>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.uploadingText}>جاري معالجة الملف...</Text>
            </>
          ) : (
            <>
              <View style={styles.uploadIconWrap}>
                <Upload color={PRIMARY} size={36} strokeWidth={2} />
              </View>
              <Text style={styles.uploadTitle}>تحديث بيانات الفواتير اليومية</Text>
              <Text style={styles.uploadSubtitle}>Upload Daily Excel</Text>
              <View style={styles.formatsRow}>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatText}>XLSX</Text>
                </View>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatText}>XLS</Text>
                </View>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatText}>CSV</Text>
                </View>
              </View>
            </>
          )}
        </Pressable>

        {/* Hidden file input */}
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        )}

        {/* Notification */}
        {notification && (
          <View
            style={[
              styles.notification,
              notification.type === 'success' ? styles.notificationSuccess : styles.notificationError,
            ]}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 color={SUCCESS} size={20} strokeWidth={2} />
            ) : (
              <XCircle color={ERROR} size={20} strokeWidth={2} />
            )}
            <Text
              style={[
                styles.notificationText,
                { color: notification.type === 'success' ? SUCCESS : ERROR },
              ]}
            >
              {notification.message}
            </Text>
            <Pressable onPress={() => setNotification(null)} style={styles.notificationClose}>
              <XCircle color={TEXT_SECONDARY} size={16} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Receipt color={PRIMARY} size={20} strokeWidth={2.5} />
            </View>
            <Text style={styles.statValue}>{loading ? '—' : invoiceCount}</Text>
            <Text style={styles.statLabel}>عدد الفواتير</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Package color={SUCCESS} size={20} strokeWidth={2.5} />
            </View>
            <Text style={styles.statValue}>{loading ? '—' : itemCount}</Text>
            <Text style={styles.statLabel}>إجمالي الأصناف</Text>
          </View>
        </View>

        {/* Expected Columns */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info color={TEXT_SECONDARY} size={18} strokeWidth={2} />
            <Text style={styles.sectionTitle}>الأعمدة المتوقعة في ملف Excel</Text>
          </View>
          <View style={styles.columnsList}>
            {expectedColumns.map((col, idx) => (
              <View key={col.key} style={styles.columnRow}>
                <View style={styles.columnIndex}>
                  <Text style={styles.columnIndexText}>{idx + 1}</Text>
                </View>
                <View style={styles.columnInfo}>
                  <Text style={styles.columnKey}>{col.key}</Text>
                  <Text style={styles.columnLabel}>{col.label}</Text>
                </View>
                <FileSpreadsheet color={TEXT_SECONDARY} size={16} strokeWidth={2} />
              </View>
            ))}
          </View>
        </View>

        {/* Offline Info */}
        <View style={styles.offlineInfo}>
          <View style={styles.offlineIcon}>
            <Database color={SUCCESS} size={20} strokeWidth={2.5} />
          </View>
          <Text style={styles.offlineText}>
            تعمل البيانات محلياً على الجهاز (IndexedDB) ويمكن استخدام التطبيق بالكامل بدون اتصال بالإنترنت بعد الرفع الأول.
          </Text>
        </View>

        {/* Clear Data */}
        {itemCount > 0 && (
          <Pressable style={styles.clearBtn} onPress={handleClearData}>
            <Trash2 color={ERROR} size={16} strokeWidth={2} />
            <Text style={styles.clearBtnText}>حذف جميع البيانات</Text>
          </Pressable>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  uploadCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: PRIMARY,
    borderStyle: 'dashed',
    marginBottom: 16,
    gap: 12,
  },
  uploadCardDisabled: {
    opacity: 0.7,
  },
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadTitle: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  uploadSubtitle: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
  },
  uploadingText: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 15,
    marginTop: 8,
  },
  formatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  formatBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatText: {
    color: PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 11,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  notificationSuccess: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  notificationError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  notificationText: {
    flex: 1,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 14,
  },
  notificationClose: {
    padding: 4,
  opacity: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 28,
  },
  statLabel: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 15,
  },
  columnsList: {
    gap: 10,
  },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  columnIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  columnIndexText: {
    color: PRIMARY,
    fontFamily: 'Cairo-Bold',
    fontSize: 13,
  },
  columnInfo: {
    flex: 1,
  },
  columnKey: {
    color: TEXT_PRIMARY,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
  },
  columnLabel: {
    color: TEXT_SECONDARY,
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  offlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    marginBottom: 16,
  },
  offlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    flex: 1,
    color: SUCCESS,
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  clearBtnText: {
    color: ERROR,
    fontFamily: 'Cairo-SemiBold',
    fontSize: 14,
  },
});
