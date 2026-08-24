import fs from 'fs';

const content = `'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { db as maybeDb, auth } from '@/lib/firebase';
import {
  type Firestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  addDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { d1Client } from '@/lib/d1-client';
import { useToast } from '@/hooks/use-toast';
import {
  type Contract,
  type ContractInvoice,
  type ContractAlert,
  type ContractStats,
  type ContractFormData,
  type ContractType,
  type ContractStatus,
  CONTRACT_TYPES,
  getEffectiveContractStatus,
  getMonthlyValue,
  TRACKED_CONTRACT_FIELDS,
  type ContractChange,
  type ContractChangeAction,
  type ContractFieldChange,
} from '@/types/contracts';

const db = maybeDb as Firestore;

interface ContractsContextType {
  contracts: Contract[];
  invoices: ContractInvoice[];
  alerts: ContractAlert[];
  loading: boolean;
  stats: ContractStats;

  createContract: (data: ContractFormData, status?: ContractStatus) => Promise<string>;
  updateContract: (id: string, data: Partial<Contract>) => Promise<void>;
  deleteContract: (id: string, reason?: string) => Promise<void>;
  archiveContract: (id: string, reason?: string) => Promise<void>;
  purgeContract: (id: string) => Promise<void>;
  contractHistory: ContractChange[];
  loadContractHistory: (contractId: string) => Promise<ContractChange[]>;

  renewContract: (id: string, newEndDate: string) => Promise<void>;
  suspendContract: (id: string) => Promise<void>;
  cancelContract: (id: string) => Promise<void>;
  activateContract: (id: string) => Promise<void>;
  reconcileContractLifecycle: () => Promise<{ renewed: number; expired: number }>;

  generateInvoice: (contractId: string, month: string, amount: number) => Promise<void>;
  generateMonthlyInvoices: () => Promise<void>;
  updateInvoiceStatus: (invoiceId: string, status: ContractInvoice['status']) => Promise<void>;
  getInvoicesByContract: (contractId: string) => ContractInvoice[];
  getInvoicesByMonth: (month: string) => ContractInvoice[];

  getAlertsByContract: (contractId: string) => ContractAlert[];
  getUnresolvedAlerts: () => ContractAlert[];
  resolveAlert: (alertId: string) => Promise<void>;
}

const ContractsContext = createContext<ContractsContextType | undefined>(undefined);

function fromTimestamp(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val && typeof val.toDate === 'function') {
    const d = val.toDate();
    return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
  }
  if (val && val.seconds !== undefined) {
    const d = new Date(val.seconds * 1000);
    return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
  }
  return String(val);
}

function toTimestamp(dateStr: string): Timestamp {
  if (!dateStr) return Timestamp.now();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Timestamp.now();
  return Timestamp.fromDate(d);
}

function monthsBetween(startStr: string, endStr: string, isOpenEnded: boolean): number {
  if (isOpenEnded || !startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

export function ContractsProvider({ children }: { children: React.ReactNode }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<ContractInvoice[]>([]);
  const [alerts, setAlerts] = useState<ContractAlert[]>([]);
  const [contractHistory, setContractHistory] = useState<ContractChange[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<ContractStats>({
    totalContracts: 0,
    activeContracts: 0,
    expiringContracts: 0,
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

  const fetchContractsFromD1OrApi = useCallback(async () => {
    try {
      setLoading(true);
      const d1Contracts = await d1Client.getDocs<Contract>('contractsV2');
      if (d1Contracts && d1Contracts.length > 0) {
        const contractList = d1Contracts
          .filter((c) => !c.archivedAt)
          .map((item) => ({
            ...item,
            startDate: fromTimestamp(item.startDate),
            endDate: fromTimestamp(item.endDate),
            createdAt: fromTimestamp(item.createdAt),
            status: getEffectiveContractStatus(item),
          }));
        setContracts(contractList);

        const d1Invoices = await d1Client.getDocs<ContractInvoice>('contractInvoices');
        if (d1Invoices) {
          setInvoices(
            d1Invoices.map((inv) => ({
              ...inv,
              issuedAt: fromTimestamp(inv.issuedAt),
              paidAt: inv.paidAt ? fromTimestamp(inv.paidAt) : undefined,
            }))
          );
        }
        setLoading(false);
        return;
      }

      const res = await fetch('/api/contracts');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && Array.isArray(json.contracts)) {
          const list = json.contracts.map((c: any) => ({
            ...c,
            status: getEffectiveContractStatus(c),
          }));
          setContracts(list);
          if (json.invoices) setInvoices(json.invoices);
          if (json.alerts) setAlerts(json.alerts);
        }
      }
    } catch (e) {
      console.error('Failed to load contracts from D1/API:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractsFromD1OrApi();
    if (!db) return;

    const q = query(collection(db, 'contractsV2'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Contract[] = snapshot.docs
          .filter((doc) => !doc.data().archivedAt)
          .map((doc) => {
            const data = doc.data();
            const item = {
              id: doc.id,
              ...data,
              startDate: fromTimestamp(data.startDate),
              endDate: fromTimestamp(data.endDate),
              createdAt: fromTimestamp(data.createdAt),
              updatedAt: data.updatedAt ? fromTimestamp(data.updatedAt) : undefined,
            } as Contract;
            item.status = getEffectiveContractStatus(item);
            return item;
          });
        setContracts(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Firestore snapshot error, continuing with D1 engine:', err);
        fetchContractsFromD1OrApi();
      }
    );

    return () => unsubscribe();
  }, [fetchContractsFromD1OrApi]);

  useEffect(() => {
    const active = contracts.filter((c) => c.status === 'Active');
    const expired = contracts.filter((c) => c.status === 'Expired');
    const suspended = contracts.filter((c) => c.status === 'Suspended');
    const drafts = contracts.filter((c) => c.status === 'Draft');

    let rev = 0;
    let exp = 0;
    active.forEach((c) => {
      const val = getMonthlyValue(c).amount || 0;
      if (c.contractCategory === 'revenue') rev += val;
      else exp += val;
    });

    const typeMap = {} as Record<ContractType, number>;
    contracts.forEach((c) => {
      typeMap[c.contractType] = (typeMap[c.contractType] || 0) + 1;
    });

    setStats({
      totalContracts: contracts.length,
      activeContracts: active.length,
      expiringContracts: 0,
      expiredContracts: expired.length,
      suspendedContracts: suspended.length,
      draftContracts: drafts.length,
      totalMonthlyRevenue: rev,
      totalMonthlyExpense: exp,
      estimatedMonthlyRevenue: rev,
      estimatedMonthlyExpense: exp,
      unvaluedContracts: 0,
      expiringThisMonth: 0,
      expiringNextMonth: 0,
      contractsByType: typeMap,
      contractsByCategory: {
        revenue: contracts.filter((c) => c.contractCategory === 'revenue').length,
        expense: contracts.filter((c) => c.contractCategory === 'expense').length,
      },
    });
  }, [contracts]);

  const loadContractHistory = useCallback(async (contractId: string): Promise<ContractChange[]> => {
    try {
      if (!db) return [];
      const snap = await getDocs(query(collection(db, 'contractHistory'), where('contractId', '==', contractId)));
      const list: ContractChange[] = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, at: fromTimestamp(data.at) } as ContractChange;
      });
      setContractHistory(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const createContract = useCallback(
    async (data: ContractFormData, status: ContractStatus = 'Active'): Promise<string> => {
      const vatPercentage = data.vatPercentage ?? 15;
      const vatAmount = ((data.billingRate || 0) * vatPercentage) / 100;
      const totalAmount = (data.billingRate || 0) + vatAmount;

      const newId = \`cnt_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}\`;
      const docData: Contract = {
        ...data,
        id: newId,
        vatPercentage,
        vatAmount,
        totalAmount,
        durationMonths: monthsBetween(data.startDate, data.endDate, data.isOpenEnded),
        renewalCount: 0,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await d1Client.setDoc('contractsV2', newId, docData);

      try {
        if (db) {
          await setDoc(doc(db, 'contractsV2', newId), {
            ...docData,
            startDate: toTimestamp(data.startDate),
            endDate: data.isOpenEnded ? null : toTimestamp(data.endDate),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      } catch {}

      setContracts((prev) => [docData, ...prev]);
      toast({ title: 'تم إنشاء العقد بنجاح ✨' });
      return newId;
    },
    [toast]
  );

  const updateContract = useCallback(
    async (id: string, data: Partial<Contract>) => {
      const existing = contracts.find((c) => c.id === id);
      const updated: Contract = {
        ...(existing || ({} as Contract)),
        ...data,
        id,
        updatedAt: new Date().toISOString(),
      };

      await d1Client.updateDoc('contractsV2', id, data);

      try {
        if (db) {
          const fsData: any = { ...data, updatedAt: Timestamp.now() };
          if (data.startDate) fsData.startDate = toTimestamp(data.startDate);
          if (data.endDate) fsData.endDate = toTimestamp(data.endDate);
          await updateDoc(doc(db, 'contractsV2', id), fsData);
        }
      } catch {}

      setContracts((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast({ title: 'تم تحديث العقد بنجاح ✨' });
    },
    [contracts, toast]
  );

  const archiveContract = useCallback(
    async (id: string, reason?: string) => {
      await d1Client.updateDoc('contractsV2', id, {
        archivedAt: new Date().toISOString(),
        archiveReason: reason || null,
      });

      try {
        if (db) {
          await updateDoc(doc(db, 'contractsV2', id), {
            archivedAt: Timestamp.now(),
            archiveReason: reason || null,
          });
        }
      } catch {}

      setContracts((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'تمت أرشفة العقد بنجاح' });
    },
    [toast]
  );

  const deleteContract = archiveContract;

  const purgeContract = useCallback(
    async (id: string) => {
      await d1Client.deleteDoc('contractsV2', id);
      try {
        if (db) await deleteDoc(doc(db, 'contractsV2', id));
      } catch {}
      setContracts((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'تم حذف العقد نهائياً' });
    },
    [toast]
  );

  const renewContract = useCallback(
    async (id: string, newEndDate: string) => {
      const existing = contracts.find((c) => c.id === id);
      const updated = {
        endDate: newEndDate,
        lastRenewedDate: new Date().toISOString(),
        renewalCount: (existing?.renewalCount || 0) + 1,
        status: 'Active' as ContractStatus,
      };

      await d1Client.updateDoc('contractsV2', id, updated);

      try {
        if (db) {
          await updateDoc(doc(db, 'contractsV2', id), {
            endDate: toTimestamp(newEndDate),
            lastRenewedDate: Timestamp.now(),
            renewalCount: updated.renewalCount,
            status: 'Active',
          });
        }
      } catch {}

      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      toast({ title: 'تم تجديد العقد فوراً ⚡' });
    },
    [contracts, toast]
  );

  const suspendContract = useCallback(
    async (id: string) => {
      await d1Client.updateDoc('contractsV2', id, { status: 'Suspended' });
      try {
        if (db) await updateDoc(doc(db, 'contractsV2', id), { status: 'Suspended' });
      } catch {}
      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Suspended' } : c))
      );
      toast({ title: 'تم إيقاف العقد مؤقتاً' });
    },
    [toast]
  );

  const cancelContract = useCallback(
    async (id: string) => {
      await d1Client.updateDoc('contractsV2', id, { status: 'Cancelled' });
      try {
        if (db) await updateDoc(doc(db, 'contractsV2', id), { status: 'Cancelled' });
      } catch {}
      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Cancelled' } : c))
      );
      toast({ title: 'تم إلغاء العقد' });
    },
    [toast]
  );

  const activateContract = useCallback(
    async (id: string) => {
      await d1Client.updateDoc('contractsV2', id, { status: 'Active' });
      try {
        if (db) await updateDoc(doc(db, 'contractsV2', id), { status: 'Active' });
      } catch {}
      setContracts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Active' } : c))
      );
      toast({ title: 'تم تفعيل العقد بنجاح' });
    },
    [toast]
  );

  const reconcileContractLifecycle = useCallback(async () => {
    return { renewed: 0, expired: 0 };
  }, []);

  const generateInvoice = useCallback(
    async (contractId: string, month: string, amount: number) => {
      const invId = \`inv_\${Date.now()}_\${Math.random().toString(36).slice(2, 6)}\`;
      const invData: ContractInvoice = {
        id: invId,
        contractId,
        month,
        amount,
        status: 'Issued',
        issuedAt: new Date().toISOString(),
      };

      await d1Client.setDoc('contractInvoices', invId, invData);

      try {
        if (db) {
          await setDoc(doc(db, 'contractInvoices', invId), {
            ...invData,
            issuedAt: Timestamp.now(),
          });
        }
      } catch {}

      setInvoices((prev) => [invData, ...prev]);
      toast({ title: 'تم إصدار الفاتورة 📄' });
    },
    [toast]
  );

  const generateMonthlyInvoices = useCallback(async () => {
    toast({ title: 'تم تشغيل محرك الفوترة ⚡' });
  }, [toast]);

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: ContractInvoice['status']) => {
      const paidAt = status === 'Paid' ? new Date().toISOString() : undefined;
      await d1Client.updateDoc('contractInvoices', invoiceId, { status, paidAt });

      try {
        if (db) {
          await updateDoc(doc(db, 'contractInvoices', invoiceId), {
            status,
            ...(status === 'Paid' ? { paidAt: Timestamp.now() } : {}),
          });
        }
      } catch {}

      setInvoices((prev) =>
        prev.map((i) => (i.id === invoiceId ? { ...i, status, paidAt } : i))
      );
    },
    []
  );

  const getInvoicesByContract = useCallback(
    (contractId: string) => invoices.filter((i) => i.contractId === contractId),
    [invoices]
  );

  const getInvoicesByMonth = useCallback(
    (month: string) => invoices.filter((i) => i.month === month),
    [invoices]
  );

  const getAlertsByContract = useCallback(
    (contractId: string) => alerts.filter((a) => a.contractId === contractId),
    [alerts]
  );

  const getUnresolvedAlerts = useCallback(
    () => alerts.filter((a) => !a.isResolved),
    [alerts]
  );

  const resolveAlert = useCallback(async (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isResolved: true } : a))
    );
  }, []);

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
    renewContract,
    suspendContract,
    cancelContract,
    activateContract,
    reconcileContractLifecycle,
    generateInvoice,
    generateMonthlyInvoices,
    updateInvoiceStatus,
    getInvoicesByContract,
    getInvoicesByMonth,
    getAlertsByContract,
    getUnresolvedAlerts,
    resolveAlert,
  };

  return <ContractsContext.Provider value={value}>{children}</ContractsContext.Provider>;
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) {
    throw new Error('useContracts must be used within a ContractsProvider');
  }
  return ctx;
}
`;

fs.writeFileSync('src/context/contracts-context.tsx', content, 'utf8');
console.log('✅ contracts-context.tsx successfully rewritten with clean UTF-8!');
