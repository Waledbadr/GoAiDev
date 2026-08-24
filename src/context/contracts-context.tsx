"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { db as maybeDb } from '@/lib/firebase';
import {
  type Firestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  addDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { isOccupancyBilled } from '@/lib/billing-engine';
import {
  type Contract,
  type ContractInvoice,
  type ContractAlert,
  type ContractStats,
  type ContractFormData,
  type ContractType,
  type ContractStatus,
  CONTRACT_TYPES,
  getContractTypeInfo,
  getEffectiveContractStatus,
  getMonthlyValue,
  TRACKED_CONTRACT_FIELDS,
  type ContractChange,
  type ContractChangeAction,
  type ContractFieldChange,
} from '@/types/contracts';

/**
 * `db` مُصدَّر بنوع `Firestore | null` لأنه يبقى null على الخادم وحين ينقص
 * إعداد Firebase. كل ما في هذا الملف إما مستمع داخل `useEffect` أو دالة تُستدعى
 * من تفاعل المستخدم — ولا يعمل أيّ منهما إلا في المتصفح بعد التهيئة. تضييق
 * النوع مرة واحدة هنا أوضح من `db!` مكرّرة عند اثنين وعشرين موضعاً، وكانت تلك
 * الأخطاء تُخفي أخطاء نوع حقيقية في نفس الملف.
 */
const db = maybeDb as Firestore;

// ---- Interface for Context ----
interface ContractsContextType {
  // البيانات
  contracts: Contract[];
  invoices: ContractInvoice[];
  alerts: ContractAlert[];
  loading: boolean;
  stats: ContractStats;

  // دوال العقود
  createContract: (data: ContractFormData, status?: ContractStatus) => Promise<string>;
  updateContract: (id: string, data: Partial<Contract>) => Promise<void>;
  /** يؤرشف العقد — لا يحذفه. الاسم محفوظ للتوافق مع الشاشات القائمة. */
  deleteContract: (id: string, reason?: string) => Promise<void>;
  archiveContract: (id: string, reason?: string) => Promise<void>;
  /** حذف نهائي مع كل الفواتير والتنبيهات. لا رجعة فيه. */
  purgeContract: (id: string) => Promise<void>;
  contractHistory: ContractChange[];
  loadContractHistory: (contractId: string) => Promise<ContractChange[]>;
  getContract: (id: string) => Contract | undefined;
  getContractsByType: (type: ContractType) => Contract[];
  getContractsByStatus: (status: ContractStatus) => Contract[];
  getContractsByResidence: (residenceId: string) => Contract[];
  getContractsByParty: (partyId: string) => Contract[];
  renewContract: (id: string, newEndDate: string) => Promise<void>;
  suspendContract: (id: string) => Promise<void>;
  cancelContract: (id: string) => Promise<void>;
  activateContract: (id: string) => Promise<void>;

  // دوال الفواتير
  generateInvoice: (contractId: string, month: string, amount: number) => Promise<void>;
  generateMonthlyInvoices: () => Promise<void>;
  getInvoicesByContract: (contractId: string) => ContractInvoice[];
  getInvoicesByMonth: (month: string) => ContractInvoice[];
  updateInvoiceStatus: (invoiceId: string, status: ContractInvoice['status']) => Promise<void>;

  // دوال التنبيهات
  checkExpiringContracts: () => Promise<void>;
  /** يثبّت الانتهاء وينفّذ التجديد التلقائي. آمن عند التكرار. */
  reconcileContractLifecycle: () => Promise<{ renewed: number; expired: number }>;
  getAlertsByContract: (contractId: string) => ContractAlert[];
  markAlertAsRead: (alertId: string) => Promise<void>;

  // إحصائيات
  calculateStats: () => void;

  // فلترة
  searchContracts: (term: string) => Contract[];
  filterContracts: (filters: {
    type?: ContractType;
    status?: ContractStatus;
    category?: 'revenue' | 'expense';
    residenceId?: string;
    partyId?: string;
  }) => Contract[];
}

const ContractsContext = createContext<ContractsContextType | null>(null);

// ---- دوال مساعدة لتحويل التواريخ ----
function fromTimestamp(ts: any): string {
  if (!ts) return '';
  if (typeof ts === 'string') return ts.split('T')[0];
  if (typeof ts.toDate === 'function') {
    try {
      return ts.toDate().toISOString().split('T')[0];
    } catch {
      return '';
    }
  }
  if (ts instanceof Date) {
    return ts.toISOString().split('T')[0];
  }
  if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
    return new Date(ts.seconds * 1000).toISOString().split('T')[0];
  }
  return String(ts).split('T')[0];
}

/**
 * الفروق بين حالتين للعقد، مقصورة على الحقول المتتبَّعة.
 * المصفوفات تُقارن بعد الترتيب: إعادة ترتيب السكنات ليست تغييراً.
 */
function diffTrackedFields(
  before: Partial<Contract> | undefined,
  after: Partial<Contract>
): ContractFieldChange[] {
  if (!before) return [];
  const changes: ContractFieldChange[] = [];

  for (const field of TRACKED_CONTRACT_FIELDS) {
    if (!(field in after)) continue;

    const rawBefore = (before as Record<string, unknown>)[field];
    const rawAfter = (after as Record<string, unknown>)[field];

    const norm = (v: unknown) =>
      Array.isArray(v) ? [...v].sort().join(',') : v === undefined ? null : (v as string | number | boolean | null);

    const b = norm(rawBefore);
    const a = norm(rawAfter);
    if (b === a) continue;

    changes.push({ field, before: b, after: a });
  }

  return changes;
}

/**
 * تاريخ النهاية بعد تجديد تلقائي واحد، محسوباً من نهاية المدة الحالية لا من
 * اليوم — وإلا ضاعت الأيام بين الانتهاء وموعد تشغيل الدورة.
 */
function nextRenewalEndDate(contract: Contract): string | null {
  if (!contract.endDate) return null;
  const end = new Date(contract.endDate);
  if (isNaN(end.getTime())) return null;

  const addMonths = (n: number) => {
    const d = new Date(end);
    d.setMonth(d.getMonth() + n);
    return d.toISOString().split('T')[0];
  };

  switch (contract.renewalType) {
    case 'auto_monthly':   return addMonths(1);
    case 'auto_quarterly': return addMonths(3);
    case 'auto_yearly':    return addMonths(12);
    case 'auto_same_duration': {
      const months = contract.durationMonths
        ?? monthsBetween(contract.startDate, contract.endDate, contract.isOpenEnded);
      return months ? addMonths(months) : null;
    }
    default:
      return null;
  }
}

/** مدة العقد بالأشهر، تُحفظ مع العقد بدل إعادة حسابها في كل شاشة. */
function monthsBetween(startDate: string, endDate: string, isOpenEnded?: boolean): number | undefined {
  if (isOpenEnded || !startDate || !endDate) return undefined;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months > 0 ? months : undefined;
}

function toTimestamp(dateStr: string): Timestamp {
  if (!dateStr) return Timestamp.now();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Timestamp.now();
  return Timestamp.fromDate(d);
}

export function ContractsProvider({ children }: { children: React.ReactNode }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<ContractInvoice[]>([]);
  const [alerts, setAlerts] = useState<ContractAlert[]>([]);
  // سجل التغييرات يُحمَّل عند الطلب لعقد واحد، لا كمستمع دائم على كل التاريخ.
  const [contractHistory, setContractHistory] = useState<ContractChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ContractStats>({
    totalContracts: 0,
    activeContracts: 0,
    expiredContracts: 0,
    suspendedContracts: 0,
    draftContracts: 0,
    totalMonthlyRevenue: 0,
    totalMonthlyExpense: 0,
    estimatedMonthlyRevenue: 0,
    estimatedMonthlyExpense: 0,
    unvaluedContracts: 0,
    expiringThisMonth: 0,
    expiringNextMonth: 0,
    contractsByType: {} as Record<ContractType, number>,
    contractsByCategory: { revenue: 0, expense: 0 },
  });

  const { toast } = useToast();

  const fetchContractsFromApi = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/contracts');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.contracts)) {
          const contractList = json.contracts.map((c: any) => {
            const item = { ...c } as Contract;
            item.status = getEffectiveContractStatus(item);
            return item;
          });
          setContracts(contractList);
          if (json.invoices) setInvoices(json.invoices);
          if (json.alerts) setAlerts(json.alerts);
        }
      }
    } catch (e) {
      console.error('Failed to load contracts from API fallback:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Real-time listener for contracts ----
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'contractsV2'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const contractList: Contract[] = snapshot.docs
          .filter(doc => !doc.data().archivedAt)
          .map(doc => {
          const data = doc.data();
          const contractItem = {
            id: doc.id,
            ...data,
            startDate: fromTimestamp(data.startDate),
            endDate: fromTimestamp(data.endDate),
            lastRenewedDate: data.lastRenewedDate ? fromTimestamp(data.lastRenewedDate) : undefined,
            createdAt: fromTimestamp(data.createdAt),
            updatedAt: data.updatedAt ? fromTimestamp(data.updatedAt) : undefined,
          } as Contract;

          // Compute effective status based on end date
          const effStatus = getEffectiveContractStatus(contractItem);
          contractItem.status = effStatus;

          return contractItem;
        });
        setContracts(contractList);
        setLoading(false);
      },
      (error) => {
        console.warn('Error on contractsV2 snapshot listener, triggering API fallback:', error);
        fetchContractsFromApi();
      }
    );

    return () => unsubscribe();
  }, [fetchContractsFromApi]);

  // ---- Real-time listener for invoices ----
  useEffect(() => {
    const q = query(collection(db, 'contractInvoices'), orderBy('issuedAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const invoiceList: ContractInvoice[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            issuedAt: fromTimestamp(data.issuedAt),
            paidAt: data.paidAt ? fromTimestamp(data.paidAt) : undefined,
          } as ContractInvoice;
        });
        setInvoices(invoiceList);
      },
      (error) => {
        console.warn('Error on contractInvoices snapshot listener:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ---- Real-time listener for alerts ----
  useEffect(() => {
    const q = query(collection(db, 'contractAlerts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const alertList: ContractAlert[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: fromTimestamp(data.createdAt),
            sentAt: data.sentAt ? fromTimestamp(data.sentAt) : undefined,
          } as ContractAlert;
        });
        setAlerts(alertList);
      },
      (error) => {
        console.warn('Error on contractAlerts snapshot listener:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ---- حساب الإحصائيات ----
  const calculateStats = useCallback(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const active = contracts.filter(c => c.status === 'Active');
    const expired = contracts.filter(c => c.status === 'Expired');
    const suspended = contracts.filter(c => c.status === 'Suspended');
    const drafts = contracts.filter(c => c.status === 'Draft');

    // العقود المنتهية هذا الشهر
    const expiringThisMonth = active.filter(c => {
      const endDate = new Date(c.endDate);
      const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
      return endMonth === thisMonth;
    }).length;

    const expiringNextMonth = active.filter(c => {
      const endDate = new Date(c.endDate);
      const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
      return endMonth === nextMonth;
    }).length;

    // القيم الشهرية
    // تُطبَّع كل أنواع الفوترة إلى مكافئ شهري بدل جمع `billingRate` كما هو،
    // وتُحصى العقود التي تعذّر تقدير قيمتها حتى لا يبدو الإجمالي أدق مما هو.
    let totalMonthlyRevenue = 0;
    let totalMonthlyExpense = 0;
    let estimatedMonthlyRevenue = 0;
    let estimatedMonthlyExpense = 0;
    let unvaluedContracts = 0;

    active.forEach(c => {
      const info = getContractTypeInfo(c.contractType);
      const { amount, basis } = getMonthlyValue(c);

      if (basis === 'unknown') {
        unvaluedContracts++;
        return;
      }

      if (info.category === 'revenue') {
        totalMonthlyRevenue += amount;
        if (basis === 'estimated') estimatedMonthlyRevenue += amount;
      } else {
        totalMonthlyExpense += amount;
        if (basis === 'estimated') estimatedMonthlyExpense += amount;
      }
    });

    // توزيع حسب النوع
    const contractsByType = {} as Record<ContractType, number>;
    CONTRACT_TYPES.forEach(t => {
      contractsByType[t.type] = contracts.filter(c => c.contractType === t.type).length;
    });

    // توزيع حسب الفئة
    const revenueCount = contracts.filter(c => c.contractCategory === 'revenue').length;
    const expenseCount = contracts.filter(c => c.contractCategory === 'expense').length;

    setStats({
      totalContracts: contracts.length,
      activeContracts: active.length,
      expiredContracts: expired.length,
      suspendedContracts: suspended.length,
      draftContracts: drafts.length,
      totalMonthlyRevenue,
      totalMonthlyExpense,
      estimatedMonthlyRevenue,
      estimatedMonthlyExpense,
      unvaluedContracts,
      expiringThisMonth,
      expiringNextMonth,
      contractsByType,
      contractsByCategory: { revenue: revenueCount, expense: expenseCount },
    });
  }, [contracts]);

  // تحديث الإحصائيات عند تغيير العقود
  useEffect(() => {
    calculateStats();
  }, [contracts, calculateStats]);

  // ---- دوال العقود ----

  const loadContractHistory = useCallback(async (contractId: string): Promise<ContractChange[]> => {
    try {
      const snap = await getDocs(query(
        collection(db, 'contractHistory'),
        where('contractId', '==', contractId)
      ));
      const list: ContractChange[] = snap.docs
        .map(d => {
          const data = d.data();
          return { id: d.id, ...data, at: fromTimestamp(data.at) } as ContractChange;
        })
        // الترتيب في الذاكرة يتجنّب فهرساً مركّباً على (contractId, at).
        .sort((a, b) => (a.at < b.at ? 1 : -1));
      setContractHistory(list);
      return list;
    } catch (error) {
      console.error('Failed to load contract history:', error);
      return [];
    }
  }, []);

  /**
   * قيد في سجل التغييرات. لا يُفشل العملية الأصلية إن تعذّرت الكتابة: فقدان
   * قيد في السجل أهون من رفض تعديل مشروع على العقد.
   */
  const recordChange = useCallback(async (
    contractId: string,
    action: ContractChangeAction,
    changes: ContractFieldChange[],
    note?: string
  ) => {
    try {
      await addDoc(collection(db, 'contractHistory'), {
        contractId,
        action,
        changes,
        byUid: auth?.currentUser?.uid || null,
        at: Timestamp.now(),
        ...(note ? { note } : {}),
      });
    } catch (error) {
      console.error('Failed to record contract change:', error);
    }
  }, []);

  const createContract = useCallback(async (data: ContractFormData, status: ContractStatus = 'Active'): Promise<string> => {
    try {
      const vatPercentage = data.vatPercentage ?? 0;
      const vatAmount = ((data.billingRate || 0) * vatPercentage) / 100;

      const contractData = {
        ...data,
        // التواريخ تُحفظ Timestamp مثلما تفعل updateContract. كانت تُكتب نصاً هنا
        // فينتهي نفس الحقل بنوعين مختلفين حسب طريقة إنشاء المستند، وهو ما يكسر
        // أي استعلام نطاق على التاريخ من الخادم.
        startDate: toTimestamp(data.startDate),
        endDate: data.isOpenEnded ? null : toTimestamp(data.endDate),
        // القيم المحسوبة تُحفظ مع العقد: الواجهة تعرضها للمستخدم قبل الحفظ،
        // فلا يجوز أن تختفي بعده وتُعاد اشتقاقها في كل شاشة على حدة.
        vatPercentage,
        vatAmount,
        totalAmount: (data.billingRate || 0) + vatAmount,
        durationMonths: monthsBetween(data.startDate, data.endDate, data.isOpenEnded),
        renewalCount: 0,
        status,
        linkedResidenceNames: [],
        createdBy: auth?.currentUser?.uid || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      let docId: string;
      try {
        const docRef = await addDoc(collection(db, 'contractsV2'), contractData);
        docId = docRef.id;
      } catch (clientErr: any) {
        console.warn('Direct Firestore addDoc failed, attempting API fallback...', clientErr);
        const res = await fetch('/api/contracts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            data: {
              ...data,
              vatPercentage,
              vatAmount,
              totalAmount: (data.billingRate || 0) + vatAmount,
              durationMonths: monthsBetween(data.startDate, data.endDate, data.isOpenEnded),
              renewalCount: 0,
              status,
              createdBy: auth?.currentUser?.uid || null,
            },
          }),
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok || !resData.ok || !resData.id) {
          throw new Error(resData.error || clientErr.message || 'Permission denied');
        }
        docId = resData.id;
      }

      await recordChange(docId, 'created', [
        { field: 'billingRate', before: null, after: data.billingRate ?? 0 },
        { field: 'status', before: null, after: status },
      ]);

      toast({
        title: 'تم إنشاء العقد',
        description: 'تم إنشاء العقد بنجاح',
      });

      return docId;
    } catch (error) {
      console.error('Error creating contract:', error);
      toast({
        title: 'خطأ في الصلاحيات أو الحفظ',
        description: 'تعذر إنشاء العقد: تأكد من تسجيل الدخول أو مراجعة الصلاحيات.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [recordChange, toast]);

  const updateContract = useCallback(async (id: string, data: Partial<Contract>) => {
    try {
      const updateData: Record<string, unknown> = { ...data, updatedAt: Timestamp.now() };
      // تحويل التواريخ
      if (data.startDate) updateData.startDate = toTimestamp(data.startDate);
      if (data.endDate) updateData.endDate = toTimestamp(data.endDate);

      // إعادة اشتقاق الضريبة والإجمالي عند تغيّر أي من طرفَي المعادلة، وإلا بقيت
      // القيم المحفوظة تعكس السعر القديم بعد تعديل السعر.
      if (data.billingRate !== undefined || data.vatPercentage !== undefined) {
        const existing = contracts.find(c => c.id === id);
        const rate = data.billingRate ?? existing?.billingRate ?? 0;
        const vatPct = data.vatPercentage ?? existing?.vatPercentage ?? 0;
        const vatAmount = (rate * vatPct) / 100;
        updateData.vatAmount = vatAmount;
        updateData.totalAmount = rate + vatAmount;
      }

      if (data.startDate || data.endDate || data.isOpenEnded !== undefined) {
        const existing = contracts.find(c => c.id === id);
        const months = monthsBetween(
          data.startDate ?? existing?.startDate ?? '',
          data.endDate ?? existing?.endDate ?? '',
          data.isOpenEnded ?? existing?.isOpenEnded
        );
        if (months !== undefined) updateData.durationMonths = months;
      }

      try {
        await updateDoc(doc(db, 'contractsV2', id), updateData);
      } catch (clientErr: any) {
        console.warn('Direct Firestore updateDoc failed, attempting API fallback...', clientErr);
        const res = await fetch('/api/contracts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id,
            data: {
              ...data,
              vatAmount: updateData.vatAmount,
              totalAmount: updateData.totalAmount,
              durationMonths: updateData.durationMonths,
            },
          }),
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok || !resData.ok) {
          throw new Error(resData.error || clientErr.message || 'Permission denied');
        }
      }

      const changes = diffTrackedFields(contracts.find(c => c.id === id), data);
      if (changes.length > 0) await recordChange(id, 'updated', changes);

      toast({
        title: 'تم تحديث العقد',
        description: 'تم تحديث العقد بنجاح',
      });
    } catch (error) {
      console.error('Error updating contract:', error);
      toast({
        title: 'خطأ في التحديث',
        description: 'حدث خطأ أو نقص في الصلاحيات أثناء تحديث العقد',
        variant: 'destructive',
      });
    }
  }, [contracts, recordChange, toast]);

  /**
   * أرشفة العقد بدل حذفه.
   */
  const archiveContract = useCallback(async (id: string, reason?: string) => {
    try {
      try {
        await updateDoc(doc(db, 'contractsV2', id), {
          archivedAt: Timestamp.now(),
          archivedBy: auth?.currentUser?.uid || null,
          archiveReason: reason || null,
          updatedAt: Timestamp.now(),
        });
      } catch (clientErr: any) {
        console.warn('Direct Firestore archive failed, attempting API fallback...', clientErr);
        await fetch('/api/contracts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id,
            data: {
              archivedAt: new Date().toISOString(),
              archivedBy: auth?.currentUser?.uid || null,
              archiveReason: reason || null,
            },
          }),
        });
      }

      await recordChange(id, 'archived', [{ field: 'archivedAt', before: null, after: 'archived' }], reason);

      toast({
        title: 'تمت أرشفة العقد',
        description: 'أُخفي العقد من القوائم، وفواتيره وتنبيهاته محفوظة كما هي.',
      });
    } catch (error) {
      console.error('Error archiving contract:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء أرشفة العقد',
        variant: 'destructive',
      });
    }
  }, [recordChange, toast]);

  /**
   * الحذف النهائي للعقد وكل ما يتبعه. مسار منفصل ومقصود، لا يُستدعى من زر
   * «حذف» في القائمة — استخدمه فقط لإزالة بيانات أُدخلت بالخطأ ولم تُصدر منها
   * أي فاتورة حقيقية.
   */
  const purgeContract = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contractsV2', id));

      // حذف الفواتير المرتبطة
      const invoicesQuery = query(collection(db, 'contractInvoices'), where('contractId', '==', id));
      const invoicesSnapshot = await getDocs(invoicesQuery);
      const batch = writeBatch(db);
      invoicesSnapshot.forEach(invoiceDoc => {
        batch.delete(invoiceDoc.ref);
      });
      await batch.commit();

      // حذف التنبيهات المرتبطة
      const alertsQuery = query(collection(db, 'contractAlerts'), where('contractId', '==', id));
      const alertsSnapshot = await getDocs(alertsQuery);
      const batch2 = writeBatch(db);
      alertsSnapshot.forEach(alertDoc => {
        batch2.delete(alertDoc.ref);
      });
      await batch2.commit();

      toast({
        title: 'تم حذف العقد نهائياً',
        description: 'حُذف العقد وجميع فواتيره وتنبيهاته. لا يمكن التراجع.',
      });
    } catch (error) {
      console.error('Error purging contract:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء الحذف النهائي',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // زر «حذف» في الواجهة يؤرشف. الاسم محفوظ للتوافق مع الشاشات القائمة.
  const deleteContract = archiveContract;

  const getContract = useCallback((id: string): Contract | undefined => {
    return contracts.find(c => c.id === id);
  }, [contracts]);

  const getContractsByType = useCallback((type: ContractType): Contract[] => {
    return contracts.filter(c => c.contractType === type);
  }, [contracts]);

  const getContractsByStatus = useCallback((status: ContractStatus): Contract[] => {
    return contracts.filter(c => c.status === status);
  }, [contracts]);

  const getContractsByResidence = useCallback((residenceId: string): Contract[] => {
    return contracts.filter(c => c.linkedResidences.includes(residenceId));
  }, [contracts]);

  const getContractsByParty = useCallback((partyId: string): Contract[] => {
    return contracts.filter(c => c.partyId === partyId);
  }, [contracts]);

  const renewContract = useCallback(async (id: string, newEndDate: string) => {
    try {
      const contract = contracts.find(c => c.id === id);
      if (!contract) throw new Error('Contract not found');

      await updateDoc(doc(db, 'contractsV2', id), {
        endDate: toTimestamp(newEndDate),
        lastRenewedDate: Timestamp.now(),
        renewalCount: (contract.renewalCount || 0) + 1,
        status: 'Active',
        updatedAt: Timestamp.now(),
      });

      await recordChange(id, 'renewed', [
        { field: 'endDate', before: contract.endDate ?? null, after: newEndDate },
        { field: 'status', before: contract.status ?? null, after: 'Active' },
      ]);

      toast({
        title: 'تم تجديد العقد',
        description: `تم تجديد العقد حتى ${newEndDate}`,
      });
    } catch (error) {
      console.error('Error renewing contract:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تجديد العقد',
        variant: 'destructive',
      });
    }
  }, [contracts, recordChange, toast]);

  const suspendContract = useCallback(async (id: string) => {
    try {
      const previous = contracts.find(c => c.id === id)?.status ?? null;
      await updateDoc(doc(db, 'contractsV2', id), {
        status: 'Suspended',
        updatedAt: Timestamp.now(),
      });
      await recordChange(id, 'suspended', [{ field: 'status', before: previous, after: 'Suspended' }]);
      toast({ title: 'تم إيقاف العقد', description: 'تم إيقاف العقد بنجاح' });
    } catch (error) {
      console.error('Error suspending contract:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إيقاف العقد', variant: 'destructive' });
    }
  }, [contracts, recordChange, toast]);

  const cancelContract = useCallback(async (id: string) => {
    try {
      const previous = contracts.find(c => c.id === id)?.status ?? null;
      await updateDoc(doc(db, 'contractsV2', id), {
        status: 'Cancelled',
        updatedAt: Timestamp.now(),
      });
      await recordChange(id, 'cancelled', [{ field: 'status', before: previous, after: 'Cancelled' }]);
      toast({ title: 'تم إلغاء العقد', description: 'تم إلغاء العقد بنجاح' });
    } catch (error) {
      console.error('Error cancelling contract:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إلغاء العقد', variant: 'destructive' });
    }
  }, [contracts, recordChange, toast]);

  const activateContract = useCallback(async (id: string) => {
    try {
      const previous = contracts.find(c => c.id === id)?.status ?? null;
      await updateDoc(doc(db, 'contractsV2', id), {
        status: 'Active',
        updatedAt: Timestamp.now(),
      });
      await recordChange(id, 'activated', [{ field: 'status', before: previous, after: 'Active' }]);
      toast({ title: 'تم تفعيل العقد', description: 'تم تفعيل العقد بنجاح' });
    } catch (error) {
      console.error('Error activating contract:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تفعيل العقد', variant: 'destructive' });
    }
  }, [contracts, recordChange, toast]);

  // ---- دوال الفواتير ----

  const generateInvoice = useCallback(async (contractId: string, month: string, amount: number) => {
    try {
      const invoiceData = {
        contractId,
        month,
        amount,
        status: 'Draft' as ContractInvoice['status'],
        issuedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'contractInvoices'), invoiceData);
      toast({ title: 'تم إنشاء الفاتورة', description: `تم إنشاء فاتورة شهر ${month}` });
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إنشاء الفاتورة', variant: 'destructive' });
    }
  }, [toast]);

  const generateMonthlyInvoices = useCallback(async () => {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const activeContracts = contracts.filter(c => c.status === 'Active');
      let count = 0;
      let skipped = 0;

      for (const contract of activeContracts) {
        // Occupancy-billed contracts (per person, per day) cannot be invoiced
        // from contract terms alone — the amount is days-housed times the rate,
        // and this context holds no occupancy data. Billing them here produced
        // an invoice for one day's rate for the whole month, so they are left
        // to the occupancy billing run instead of being silently under-billed.
        if (isOccupancyBilled(contract.contractType, contract.billingType)) {
          skipped++;
          continue;
        }

        // التحقق من عدم وجود فاتورة لنفس الشهر
        const existingQuery = query(
          collection(db, 'contractInvoices'),
          where('contractId', '==', contract.id),
          where('month', '==', month)
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (existingSnapshot.empty) {
          const monthlyRate = contract.billingType === 'fixed_monthly'
            ? contract.billingRate
            : contract.services
              ? contract.services.reduce((sum, s) => sum + s.rate, 0)
              : contract.billingRate;

          await generateInvoice(contract.id, month, monthlyRate);
          count++;
        }
      }

      toast({
        title: 'تم إنشاء الفواتير',
        description: skipped > 0
          ? `تم إنشاء ${count} فاتورة. تم تخطي ${skipped} عقد تسكين (تُحسب من الإشغال).`
          : `تم إنشاء ${count} فاتورة للشهر الحالي`,
      });
    } catch (error) {
      console.error('Error generating monthly invoices:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء إنشاء الفواتير', variant: 'destructive' });
    }
  }, [contracts, generateInvoice, toast]);

  const getInvoicesByContract = useCallback((contractId: string): ContractInvoice[] => {
    return invoices.filter(i => i.contractId === contractId);
  }, [invoices]);

  const getInvoicesByMonth = useCallback((month: string): ContractInvoice[] => {
    return invoices.filter(i => i.month === month);
  }, [invoices]);

  const updateInvoiceStatus = useCallback(async (invoiceId: string, status: ContractInvoice['status']) => {
    try {
      const updateData: any = { status, updatedAt: Timestamp.now() };
      if (status === 'Paid') {
        updateData.paidAt = Timestamp.now();
      }
      await updateDoc(doc(db, 'contractInvoices', invoiceId), updateData);
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تحديث الفاتورة', variant: 'destructive' });
    }
  }, [toast]);

  /**
   * تثبيت دورة حياة العقود.
   *
   * `getEffectiveContractStatus` تحسب «منتهٍ» في المتصفح وتكتبها فوق الحالة
   * القادمة من Firestore، لكنها لا تُحفظ: العقد المنتهي يبقى `Active` في قاعدة
   * البيانات، فأي استعلام من الخادم يراه نشطاً. وحقول `autoRenew` و
   * `renewalType` تُحفظ ولا يقرؤها أحد، فـ«تجديد تلقائي» في الواجهة لم يكن
   * يجدّد شيئاً.
   *
   * تمرّ هذه الدالة على العقود المنتهية فتمدّد ما هو تلقائي التجديد، وتثبّت
   * حالة «منتهٍ» لما تبقّى. آمنة عند التكرار: العقد الذي عولج مرة لا يعود
   * مؤهلاً في المرة التالية.
   */
  const reconcileContractLifecycle = useCallback(async (): Promise<{ renewed: number; expired: number }> => {
    const summary = { renewed: 0, expired: 0 };
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (const contract of contracts) {
      if (contract.isOpenEnded || !contract.endDate) continue;
      if (contract.endDate >= todayStr) continue;
      // الموقوف والملغى والمسودة خارج الدورة التلقائية: حالتها قرار بشري.
      if (contract.status === 'Suspended' || contract.status === 'Cancelled' || contract.status === 'Draft') continue;

      try {
        if (contract.autoRenew && contract.renewalType !== 'manual') {
          const newEndDate = nextRenewalEndDate(contract);
          if (!newEndDate) continue;

          await updateDoc(doc(db, 'contractsV2', contract.id), {
            endDate: toTimestamp(newEndDate),
            lastRenewedDate: Timestamp.now(),
            renewalCount: (contract.renewalCount || 0) + 1,
            status: 'Active',
            updatedAt: Timestamp.now(),
          });
          await recordChange(contract.id, 'renewed', [
            { field: 'endDate', before: contract.endDate, after: newEndDate },
          ], 'تجديد تلقائي');
          summary.renewed++;
        } else {
          await updateDoc(doc(db, 'contractsV2', contract.id), {
            status: 'Expired',
            updatedAt: Timestamp.now(),
          });
          await recordChange(contract.id, 'updated', [
            { field: 'status', before: 'Active', after: 'Expired' },
          ], 'انتهت المدة');
          summary.expired++;
        }
      } catch (error) {
        console.error(`Lifecycle reconcile failed for contract ${contract.id}:`, error);
      }
    }

    if (summary.renewed > 0 || summary.expired > 0) {
      toast({
        title: 'تحديث دورة حياة العقود',
        description: `جُدّد ${summary.renewed} عقد تلقائياً، وثُبّت انتهاء ${summary.expired} عقد.`,
      });
    }

    return summary;
  }, [contracts, recordChange, toast]);

  // ---- دوال التنبيهات ----

  const checkExpiringContracts = useCallback(async () => {
    try {
      const now = new Date();
      const activeContracts = contracts.filter(c => c.status === 'Active');

      for (const contract of activeContracts) {
        const endDate = new Date(contract.endDate);
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const alertConfigs = [
          { days: 30, type: 'expiry_30days' as const },
          { days: 14, type: 'expiry_14days' as const },
          { days: 7, type: 'expiry_7days' as const },
        ];

        for (const config of alertConfigs) {
          if (diffDays <= config.days && diffDays > 0) {
            // التحقق من وجود تنبيه مسبق
            const existingQuery = query(
              collection(db, 'contractAlerts'),
              where('contractId', '==', contract.id),
              where('alertType', '==', config.type)
            );
            const existingSnapshot = await getDocs(existingQuery);

            if (existingSnapshot.empty) {
              await addDoc(collection(db, 'contractAlerts'), {
                contractId: contract.id,
                alertType: config.type,
                sent: false,
                read: false,
                createdAt: Timestamp.now(),
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking expiring contracts:', error);
    }
  }, [contracts]);

  const getAlertsByContract = useCallback((contractId: string): ContractAlert[] => {
    return alerts.filter(a => a.contractId === contractId);
  }, [alerts]);

  const markAlertAsRead = useCallback(async (alertId: string) => {
    try {
      await updateDoc(doc(db, 'contractAlerts', alertId), { read: true });
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  }, []);

  // ---- فلترة وبحث ----

  const searchContracts = useCallback((term: string): Contract[] => {
    if (!term.trim()) return contracts;
    const lower = term.toLowerCase();
    return contracts.filter(c =>
      c.partyName.toLowerCase().includes(lower) ||
      c.notes?.toLowerCase().includes(lower) ||
      c.id.toLowerCase().includes(lower)
    );
  }, [contracts]);

  const filterContracts = useCallback((filters: {
    type?: ContractType;
    status?: ContractStatus;
    category?: 'revenue' | 'expense';
    residenceId?: string;
    partyId?: string;
  }): Contract[] => {
    let result = [...contracts];

    if (filters.type) result = result.filter(c => c.contractType === filters.type);
    if (filters.status) result = result.filter(c => c.status === filters.status);
    if (filters.category) result = result.filter(c => c.contractCategory === filters.category);
    if (filters.residenceId) result = result.filter(c => c.linkedResidences.includes(filters.residenceId!));
    if (filters.partyId) result = result.filter(c => c.partyId === filters.partyId);

    return result;
  }, [contracts]);

  const value: ContractsContextType = {
    contracts,
    invoices,
    alerts,
    loading,
    stats,
    createContract,
    updateContract,
    deleteContract,
    archiveContract,
    purgeContract,
    contractHistory,
    loadContractHistory,
    getContract,
    getContractsByType,
    getContractsByStatus,
    getContractsByResidence,
    getContractsByParty,
    renewContract,
    suspendContract,
    cancelContract,
    activateContract,
    generateInvoice,
    generateMonthlyInvoices,
    getInvoicesByContract,
    getInvoicesByMonth,
    updateInvoiceStatus,
    checkExpiringContracts,
    reconcileContractLifecycle,
    getAlertsByContract,
    markAlertAsRead,
    calculateStats,
    searchContracts,
    filterContracts,
  };

  return (
    <ContractsContext.Provider value={value}>
      {children}
    </ContractsContext.Provider>
  );
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) {
    throw new Error('useContracts must be used within a ContractsProvider');
  }
  return ctx;
}
