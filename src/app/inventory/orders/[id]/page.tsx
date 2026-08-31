'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrders, type Order } from '@/context/orders-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Pencil, CheckCircle2, XCircle, PackageCheck, FileText, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useUsers } from '@/context/users-context';
import type { OrderItem } from '@/context/orders-context';
import { useInventory } from '@/context/inventory-context';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useResidences } from '@/context/residences-context';
import { ApprovalAttachmentDialog } from '@/components/inventory/approval-attachment-dialog';
// Subscribe to D1 document for updates
import { db } from '@/lib/firebase';
import { d1Client } from '@/lib/d1-client';
import { doc, onSnapshot, getDoc, collection, query as fbQuery, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';

export default function OrderDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { updateOrderStatus, loading: ordersLoading } = useOrders();
    const { getStockForResidence, items: allItems } = useInventory();
    const { currentUser, users, loading: usersLoading, getUserById } = useUsers();
    const { residences } = useResidences();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);

    const isAdmin = currentUser?.role === 'Admin';
    const requestedBy = order?.requestedById ? getUserById(order.requestedById) : null;
    const approvedBy = order?.approvedById ? getUserById(order.approvedById) : null;
    const [requestedByNameLocal, setRequestedByNameLocal] = useState<string>('...');
    const requestedByName = order?.requestedByName || requestedBy?.name || requestedByNameLocal || order?.requestedByEmail || '...';
    const approvedByName = order?.approvedByName || approvedBy?.name || '...';

    // Last dates for items with justifications (per residence)
    const [lastDates, setLastDates] = useState<Record<string, { lastReceive?: Date | null; lastIssue?: Date | null }>>({});
    useEffect(() => {
        const run = async () => {
            if (!db || !order) return;
            const residenceId = order.residenceId;
            const itemsNeedingReview = Array.isArray(order.items) ? order.items.map((it, idx) => ({ it, idx })).filter(x => !!x.it.overrideReason) : [];
            const results: Record<string, { lastReceive?: Date | null; lastIssue?: Date | null }> = {};
            const getBaseId = (raw?: string) => (raw || '').split('-')[0];
            await Promise.all(itemsNeedingReview.map(async ({ it }) => {
                const key = it.id;
                const baseId = getBaseId(it.id as any);
                const txCol = collection(db as any, 'inventoryTransactions');
                // Last receive (IN/RECEIVE)
                const recvQ = fbQuery(txCol, where('residenceId', '==', residenceId), where('itemId', '==', baseId), where('type', 'in', ['RECEIVE', 'IN'] as any));
                const recvSnap = await getDocs(recvQ);
                let lastRecv: Date | null = null;
                recvSnap.forEach(docu => {
                    const d = (docu.data() as any)?.date;
                    const dt = d?.toDate ? d.toDate() : (d ? new Date(d) : null);
                    if (dt && (!lastRecv || dt > lastRecv)) lastRecv = dt;
                });
                // Last issue (OUT)
                const outQ = fbQuery(txCol, where('residenceId', '==', residenceId), where('itemId', '==', baseId), where('type', '==', 'OUT'));
                const outSnap = await getDocs(outQ);
                let lastOut: Date | null = null;
                outSnap.forEach(docu => {
                    const d = (docu.data() as any)?.date;
                    const dt = d?.toDate ? d.toDate() : (d ? new Date(d) : null);
                    if (dt && (!lastOut || dt > lastOut)) lastOut = dt;
                });
                results[key] = { lastReceive: lastRecv, lastIssue: lastOut };
            }));
            setLastDates(results);
        };
        run();
    }, [order?.id]);

    // Resolve requester name if missing by fetching users/{requestedById} or by email
    useEffect(() => {
        const run = async () => {
            if (!db) return;
            const missing = !(order?.requestedByName) && !requestedBy?.name;
            if (!order?.requestedById || !missing) return;
            try {
                // Try direct doc by ID
                const uref = doc(db, 'users', order.requestedById);
                const usnap = await getDoc(uref);
                if (usnap.exists()) {
                    const nm = (usnap.data() as any)?.name || '';
                    if (nm) { setRequestedByNameLocal(nm); return; }
                }
                // Fallback: query by email when available on order
                const em = (order as any)?.requestedByEmail;
                if (em) {
                    const q = fbQuery(collection(db, 'users'), where('email', '==', em));
                    const qs = await getDocs(q);
                    const nm = qs.docs.map(d => (d.data() as any)?.name).find(Boolean);
                    if (nm) { setRequestedByNameLocal(nm as string); return; }
                }
            } catch {}
        };
        run();
        // We intentionally do not depend on requestedByNameLocal to avoid loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, order?.requestedById, order?.requestedByName, requestedBy?.name, (order as any)?.requestedByEmail]);

    // Helper to normalize items when they were accidentally saved as an object with numeric keys
    const normalizeItems = (items: any): any[] => {
        if (Array.isArray(items)) return items;
        if (items && typeof items === 'object') {
            const keys = Object.keys(items);
            const numericKeys = keys.filter(k => /^\d+$/.test(k)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            if (numericKeys.length > 0) return numericKeys.map(k => (items as any)[k]);
            // Fallback: if values look like line items, return Object.values
            const values = Object.values(items);
            if (values.length > 0 && values.every(v => v && typeof v === 'object')) return values as any[];
        }
        return [];
    };

    useEffect(() => {
        if (!id || typeof id !== 'string') return;
        setLoading(true);
        async function fetchOrder() {
            try {
                const data = await d1Client.getDoc<any>('orders', id as string);
                if (data) {
                    const itemsArray = normalizeItems(data.items);
                    const normalizedData = { ...data, items: itemsArray };
                    setOrder({ id, ...normalizedData } as Order);
                } else {
                    setOrder(null);
                }
            } catch (err) {
                console.error('Error fetching order doc from D1:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchOrder();
    }, [id]);

    const handlePrint = () => {
        window.print();
    }

    const handleEdit = () => {
        router.push(`/inventory/orders/${id}` + '/edit');
    }

    const handleApprove = () => {
        if (!order || !currentUser) return;
        setShowApprovalDialog(true);
    };

    const handleApproveWithAttachment = async (
        attachmentData: {
            url: string;
            path: string;
            filename: string;
        } | null
    ) => {
        if (!order || !currentUser) return;
        await updateOrderStatus(order.id, 'Approved', currentUser.id, attachmentData);
        // UI will update via onSnapshot
        // Navigate back to orders list per flow requirement
        router.push('/inventory/orders');
    };

    const handleReject = async () => {
        if (!order) return;
        const ok = window.confirm('Reject and cancel this request?');
        if (!ok) return;
        await updateOrderStatus(order.id, 'Cancelled');
        // UI will update via onSnapshot
    };

    const goToReceive = () => {
        if (!order) return;
        router.push(`/inventory/receive/${order.id}`);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-4 w-80" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="text-center py-10">
                <p className="text-xl text-muted-foreground">Request not found.</p>
                    <Button onClick={() => router.push('/inventory/orders')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        )
    }
    
     const handleGetStockForResidence = (item: OrderItem) => {
        if (!order?.residenceId) return 0;
        // Some legacy orders may store itemId instead of id
        const rawId = (item as any).id ?? (item as any).itemId;
        if (!rawId) return 0;
        // Order items may append a variant after '::', keep the base document id
        const raw = String(rawId);
        const baseItemId = raw.includes('::') ? raw.split('::')[0] : raw;
        const baseItem = allItems.find(i => i.id === baseItemId);
        if (!baseItem) return 0;
        return getStockForResidence(baseItem, order.residenceId);
    }

    // Build items for main table: include all normal lines, and only approved justification lines (use approvedQuantity)
    const rawItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const itemsForRender: OrderItem[] = rawItems
        .map((it) => {
            if (!it) return null as any;
            const needsReview = !!it.overrideReason;
            if (!needsReview) return it;
            // Only include if approved; set quantity to approvedQuantity
            if (it.justificationDecision === 'approved') {
                const q = typeof it.approvedQuantity === 'number' ? it.approvedQuantity : 0;
                if (q > 0) return { ...it, quantity: q } as OrderItem;
                return null as any;
            }
            return null as any; // pending or rejected => not shown in main list
        })
        .filter(Boolean) as OrderItem[];

    const totalItems = itemsForRender.length;

    const groupedItems = itemsForRender.reduce((acc, item) => {
        const category = item.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, Order['items']>);

    const canApproveReject = isAdmin && order.status === 'Pending';
    const canReceive = order.status === 'Approved' || order.status === 'Partially Delivered';
    const canEdit = !!order && (order.status === 'Pending' ? (isAdmin || currentUser?.id === order.requestedById) : isAdmin);

    // Helper to format legacy ids
    const formatOrderId = (id: string) => {
        if (!id) return id;
        if (id.startsWith('MR-')) return id;
        const m = id.match(/^(\d{2})-(\d{2})-(\d{3})$/);
        if (m) {
            const yy = m[1];
            const mmNoPad = String(parseInt(m[2], 10));
            const seq = String(parseInt(m[3], 10));
            return `MR-${yy}${mmNoPad}${seq}`;
        }
        return id;
    };

    // Helper: split name into base and detail using " - " convention
    const splitNameDetail = (name?: string): { base: string; detail: string } => {
        const raw = (name || '').trim();
        if (!raw) return { base: '', detail: '' };
        const parts = raw.split(' - ');
        if (parts.length <= 1) return { base: raw, detail: '' };
        return { base: parts[0].trim(), detail: parts.slice(1).join(' - ').trim() };
    };

    // Header: show city/location before residence name, e.g., "Riyadh: Um Al-Salem"
    const currentResidence = order?.residenceId ? residences.find(r => r.id === order.residenceId) : undefined;
    const residenceNameText = order?.residence || currentResidence?.name || '—';
    const cityText = (currentResidence?.city || (currentResidence as any)?.locationString || (currentResidence as any)?.address || '').toString().trim();
    const residenceHeaderText = cityText ? `${cityText}: ${residenceNameText}` : residenceNameText;

    // Safely format Firestore Timestamp | Date | string
    const formattedOrderDate = (() => {
        try {
            const d: any = (order as any)?.date;
            if (!d) return '—';
            const jsDate: Date = typeof d?.toDate === 'function' ? d.toDate() : (d instanceof Date ? d : new Date(d));
            if (!jsDate || isNaN(jsDate.getTime())) return '—';
            return format(jsDate, 'PPP');
        } catch {
            return '—';
        }
    })();

    return (
        <div className="space-y-6">
             <style jsx global>{`
                                /* Screen: ensure only Notes column uses RTL direction with LTR alignment and bidi isolation */
                                .notes-cell {
                                    direction: rtl;
                                    text-align: left; /* keep visual alignment to the left while base direction is RTL */
                                    unicode-bidi: isolate; /* isolate mixed LTR/RTL sequences to avoid reordering issues */
                                }
                                .notes-cell .bidi-notes {
                                    direction: rtl;
                                    unicode-bidi: plaintext; /* let each run resolve its own direction for stable number+unit order */
                                }
                @page {
                    size: A4 portrait;
                    margin: 5mm;
                }
                @media print {
                  html, body { height: auto !important; }
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    background-color: white !important;
                    font-size: 13px !important; /* base body size */
                    line-height: 1.25 !important; /* was 1.15 */
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  .printable-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: auto;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    background-color: white !important;
                    color: black !important;
                  }
                  .print-only-logo { display: none; }
                  .no-print { display: none !important; }

                  /* Compact table for printing */
                  .print-compact-table { border-collapse: collapse !important; width: 100% !important; }
                  .print-compact-table thead th {
                    font-weight: 700 !important;
                    font-size: 10px !important; /* was 9px */
                    padding: 4px 6px !important; /* was 3px 4px */
                    background: white !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    color: #111 !important;
                    white-space: nowrap !important;
                  }
                  .print-compact-table tbody td {
                    font-size: 10px !important; /* was 9px */
                    padding: 3px 6px !important; /* was 2px 4px */
                    border-top: 1px solid #f1f5f9 !important;
                    vertical-align: middle !important;
                    background: white !important;
                  }
                  .print-compact-table .category-row td {
                    padding-top: 4px !important; /* was 3px */
                    padding-bottom: 4px !important; /* was 3px */
                    background: white !important;
                    color: #0f766e !important;
                    font-weight: 700 !important;
                    border-top: 1px solid #e2e8f0 !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                  }

                  /* Clamp and tighten notes column */
                  .print-notes {
                    max-width: 220px !important; /* was 180px */
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                    color: #111 !important; /* match item column color */
                    direction: rtl !important;
                    text-align: left !important;
                    unicode-bidi: isolate !important;
                  }

                  /* Tighten header area */
                  .print-header-title { font-size: 22px !important; margin-bottom: 2px !important; font-weight: 800 !important; }
                  .print-id { font-size: 16px !important; font-weight: 700 !important; color: #1f2937 !important; }
                  .print-subtle { font-size: 10px !important; color: #4b5563 !important; }
                  .print-badge { font-size: 10px !important; /* was 9px */ padding: 2px 8px !important; /* slightly larger */ }

                  /* Hide status badge on print */
                  .status-badge { display: none !important; }

                  /* Header right block: residence and date sizes */
                  .print-residence-title { font-size: 22px !important; font-weight: 800 !important; }
                  .print-date { font-size: 14px !important; color: #1f2937 !important; }

                  /* Compact notes card on print */
                  .print-notes-card { margin-bottom: 8px !important; background-color: white !important; border: 1px solid #e5e7eb !important; box-shadow: none !important; }
                  .print-notes-header { padding-top: 4px !important; padding-bottom: 2px !important; background-color: white !important; }
                  .print-notes-title { font-size: 12px !important; color: #0f766e !important; font-weight: 700 !important; }
                  .print-notes-content { padding-top: 0 !important; padding-bottom: 4px !important; }
                  .print-notes-text { font-size: 11px !important; color: #111 !important; }

                  .print-only-logo {
                    display: none;
                  }
                  
                  /* These rules must be direct children of the main @media print block */
                  .print-only-logo {
                    display: flex !important;
                    justify-content: center;
                    align-items: center;
                  }
                  .print-only-logo img {
                    height: 60px !important;
                    object-fit: contain !important;
                  }

                  /* Total row */
                  .print-total { margin-top: 6px !important; padding-top: 6px !important; border-top: 1px solid #e5e7eb !important; font-size: 11px !important; /* was 10px */ }

                  /* Signatures compact */
                  .print-signatures { margin-top: 8px !important; padding-top: 6px !important; border-top: 1px solid #e5e7eb !important; }
                  .print-signatures .slot { width: 120px !important; margin-top: 6px !important; }
                  .print-signatures .label { font-size: 10px !important; /* was 9px */ color: #111 !important; }
                  .print-signatures .line { border-top: 1px solid #000 !important; width: 90px !important; /* was 80px */ margin-top: 6px !important; }
                }
            `}</style>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between no-print mb-6">
                <Button variant="outline" onClick={() => router.push('/inventory/orders')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Requests
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                    {canApproveReject && (
                        <>
                            <Button onClick={handleApprove} disabled={ordersLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                            </Button>
                            <Button onClick={handleReject} variant="destructive" disabled={ordersLoading}>
                                <XCircle className="mr-2 h-4 w-4" /> Reject
                            </Button>
                        </>
                    )}
                    {canReceive && (
                        <Button onClick={goToReceive} variant="secondary">
                            <PackageCheck className="mr-2 h-4 w-4" /> Receive MRV
                        </Button>
                    )}
                                        {canEdit && (
                                                <>
                                                    {Array.isArray(order.plannedDistribution) && order.plannedDistribution.length > 0 ? (
                                                        <Button variant="secondary" onClick={() => router.push(`/inventory/orders/${order.id}/edit-plan`)}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit Plan
                                                        </Button>
                                                    ) : (
                                                        <Button variant="secondary" onClick={handleEdit}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit Request
                                                        </Button>
                                                    )}
                                                </>
                                        )}
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print Request
                    </Button>
                </div>
            </div>

            <Card className="printable-area">
                <CardHeader className="border-b print:border-b-2">
                    <div className="flex justify-between items-start">
                        <div className="w-1/3">
                            {/* Title: English only as requested */}
                            <CardTitle className="text-3xl print-title print-header-title">Materials Request</CardTitle>
                            <CardDescription className="text-lg print-id flex flex-col">
                                <span>ID: #{formatOrderId(order.id)}</span>
                            </CardDescription>
                        </div>
                        <div className="w-1/3 print-only-logo">
                            <img src="/logo.png" alt="SACODECO CPC Logo" />
                        </div>
                        <div className="w-1/3 text-right">
                            <p className="font-semibold print-residence-title" style={{ fontWeight: 700 }}>{residenceHeaderText}</p>
                            <p className="text-sm text-muted-foreground print-date">{formattedOrderDate}</p>
                            <p className="text-sm font-semibold text-gray-800 mt-1">Department: Housing</p>
                            <Badge className="mt-2 print-badge status-badge" variant={
                                order.status === 'Delivered' ? 'default'
                                : order.status === 'Approved' ? 'secondary'
                                : order.status === 'Partially Delivered' ? 'secondary'
                                : order.status === 'Cancelled' ? 'destructive'
                                : 'outline'
                            }>
                                {order.status}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <table className="w-full text-sm print-table print-compact-table">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left rtl:text-right align-middle font-medium text-muted-foreground w-[45%]">الصنف • Item</th>
                                <th className="h-12 px-4 text-left rtl:text-right align-middle font-medium text-muted-foreground w-[25%]">ملاحظات • Notes</th>
                                <th className="h-12 px-4 text-left rtl:text-right align-middle font-medium text-muted-foreground w-[10%]">وحدة • Unit</th>
                                <th className="h-12 px-4 text-left rtl:text-right align-middle font-medium text-muted-foreground w-[10%] text-right">الكمية • Qty</th>
                                <th className="h-12 px-4 text-left rtl:text-right align-middle font-medium text-muted-foreground w-[10%] text-center">المتوفر • Stock</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {Object.entries(groupedItems).map(([category, items]) => (
                                <React.Fragment key={category}>
                                    <tr key={`cat-${category}`} className="bg-muted/50 hover:bg-muted/50 print-bg-muted category-row border-b transition-colors">
                                        <td colSpan={5} className="p-4 align-middle font-semibold text-primary capitalize py-2">
                                            {category}
                                        </td>
                                    </tr>
                                    {items.map((item: OrderItem, idx: number) => {
                                        // Safety check for item integrity
                                        if (!item || typeof item !== 'object') return null;
                                        
                                        const ar = splitNameDetail(item.nameAr);
                                        const en = splitNameDetail(item.nameEn);
                                        const detail = ar.detail || en.detail || '';
                                        const notes = (() => {
                                            const baseNotes = (item.notes || '').trim();
                                            if (detail && baseNotes) return `${baseNotes}  ${detail}`; // append detail to notes
                                            if (detail) return detail;
                                            return baseNotes || '-';
                                        })();
                                        
                                        // Safe key generation
                                        const safeId = item.id || `unknown-${idx}`;
                                        return (
                                            <tr key={`${safeId}-${idx}`} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                <td className="p-4 align-middle font-medium">
                                                    {en.base || item.nameEn} | {ar.base || item.nameAr}
                                                </td>
                                                <td className="p-4 align-middle notes-cell print-notes">
                                                    <span className="bidi-notes">{notes}</span>
                                                </td>
                                                <td className="p-4 align-middle">{item.unit}</td>
                                                <td className="p-4 align-middle text-right font-medium">{item.quantity}</td>
                                                <td className="p-4 align-middle text-center">{handleGetStockForResidence(item)}</td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    
                    <div className="mt-6 flex justify-between items-start border-t pt-4 print-total">
                        <div className="text-left flex-1 pr-4">
                            {order.notes && (
                                <>
                                    <span className="font-bold text-primary print-notes-title">Notes: </span>
                                    <span className="text-foreground print-notes-text" dir="auto">{order.notes}</span>
                                </>
                            )}
                        </div>
                        <div className="text-right font-bold text-lg pl-4 whitespace-nowrap">
                            Total Items: {totalItems}
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="mt-8 pt-4 border-t print-signatures">
                    <div className="grid grid-cols-2 gap-8 w-full">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground label">Requested By:</p>
                            <p className="font-semibold print-subtle" style={{ fontWeight: 700 }}>{requestedByName}</p>
                            <div className="mt-2 border-t-2 w-48 line slot"></div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground label">Approved By:</p>
                            <p className="font-semibold print-subtle" style={{ fontWeight: 700 }}>{approvedByName}</p>
                            <div className="mt-2 border-t-2 w-48 line slot"></div>
                        </div>
                    </div>
                </CardFooter>
            </Card>
                        {canApproveReject && (Array.isArray(order.items) && order.items.some(it => !!it?.overrideReason)) && (
                            <Card className="no-print">
                                <CardHeader>
                                    <CardTitle>مراجعة التبريرات</CardTitle>
                                    <CardDescription>اعتماد أو رفض الأصناف التي تتطلب تبريراً وتحديد الكمية المقبولة عند الاعتماد.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الصنف</TableHead>
                                                <TableHead>مبرر الطالب</TableHead>
                                                <TableHead>آخر استلام</TableHead>
                                                <TableHead>آخر صرف/تركيب</TableHead>
                                                <TableHead className="text-center">قرار</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Array.isArray(order.items) ? order.items.map((it, idx) => {
                                                if (!it || !it.overrideReason) return null;
                                                const ar = splitNameDetail(it.nameAr);
                                                const en = splitNameDetail(it.nameEn);
                                                const key = it.id || `unknown-${idx}`;
                                                const dates = lastDates[key] || {};
                                                const fmt = (d?: Date | null) => {
                                                    try {
                                                        return d && !isNaN(d.getTime()) ? format(d, 'PPP') : '—';
                                                    } catch {
                                                        return '—';
                                                    }
                                                };
                                                return (
                                                    <TableRow key={`${key}-${idx}`}>
                                                        <TableCell className="font-medium">{en.base || it.nameEn} | {ar.base || it.nameAr}</TableCell>
                                                        <TableCell className="max-w-[320px] whitespace-pre-wrap">{it.overrideReason}</TableCell>
                                                        <TableCell>{fmt(dates.lastReceive)}</TableCell>
                                                        <TableCell>{fmt(dates.lastIssue)}</TableCell>
                                                        <TableCell className="text-center">
                                                            <JustificationCell orderId={order.id} itemIndex={idx} item={it as any} />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }) : null}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

            {/* Approval Attachment Section */}
            {order.status === 'Approved' && order.approvalAttachmentUrl && (
                <Card className="no-print">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-600" />
                            Approval Attachment
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-primary" />
                                <div>
                                    <p className="font-medium" dir="ltr">
                                        {order.approvalAttachmentName || 'Approval Document'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {order.approvalAttachmentUploadedAt && 
                                            `Uploaded: ${format(
                                                order.approvalAttachmentUploadedAt.toDate(),
                                                'PPp'
                                            )}`
                                        }
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(order.approvalAttachmentUrl!, '_blank')}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Approval Dialog */}
            <ApprovalAttachmentDialog
                open={showApprovalDialog}
                onOpenChange={setShowApprovalDialog}
                onApprove={handleApproveWithAttachment}
                orderId={order?.id || ''}
            />
        </div>
    )
}

function JustificationCell({ orderId, itemIndex, item }: { orderId: string; itemIndex: number; item: OrderItem }) {
    // Safety checks for item properties
    const safeItem = item || {} as OrderItem;
    const safeQuantity = typeof safeItem.quantity === 'number' ? safeItem.quantity : 0;
    const safeApprovedQuantity = typeof safeItem.approvedQuantity === 'number' ? safeItem.approvedQuantity : safeQuantity;
    
    const [note, setNote] = React.useState(safeItem.justificationReviewNote || '');
    const [qty, setQty] = React.useState<number>(safeApprovedQuantity);
    const [saving, setSaving] = React.useState(false);
    const decision = safeItem.justificationDecision;
    const pending = typeof decision === 'undefined' && !!safeItem.overrideReason;
    const disabled = !pending;
    const clampQty = (n: number) => Math.max(0, Math.min(n, safeQuantity));
    const apply = async (value: 'approved' | 'rejected') => {
        if (saving) return;
        setSaving(true);
        try {
            if (!db) return;
            const ref = doc(db, 'orders', orderId);
            // Read current items, update the target element, then write back the whole array (Firestore-safe)
            const snap = await getDoc(ref);
            if (!snap.exists()) throw new Error('Order not found');
            const data = snap.data() as any;
            const items: any[] = Array.isArray(data.items) ? data.items : [];
            const idx = itemIndex;
            if (!(idx in items)) throw new Error('Item index out of range');
            const existing = items[idx] || {};
            const updated = {
                ...existing,
                justificationDecision: value,
                justificationReviewNote: note || null,
                approvedQuantity: value === 'approved' ? clampQty(qty) : 0,
            };
            const newItems = items.slice();
            newItems[idx] = updated;
            await updateDoc(ref, { items: newItems } as any);
        } catch (e) {
            console.error('Failed to update line decision', e);
            alert('Failed to update decision');
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="text-xs max-w-[220px] break-words whitespace-pre-wrap">
                <span className="font-semibold">مبرر الطالب:</span> {safeItem.overrideReason || '—'}
            </div>
            <div className="flex items-center gap-2 text-xs">
                <span>الكمية المقبولة:</span>
                <input
                    type="number"
                    className="border rounded px-2 py-1 text-xs w-20 text-center"
                    min={0}
                    max={safeQuantity}
                    value={qty}
                    onChange={(e) => setQty(clampQty(parseInt(e.target.value || '0', 10)))}
                    disabled={!pending}
                />
                <span className="text-muted-foreground">/ {safeQuantity}</span>
            </div>
            <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" disabled={disabled || saving} onClick={() => apply('approved')}>{saving ? '...': 'قبول'}</Button>
                <Button size="sm" variant="destructive" disabled={disabled || saving} onClick={() => apply('rejected')}>{saving ? '...': 'رفض'}</Button>
            </div>
            <input
                className="border rounded px-2 py-1 text-xs w-full"
                placeholder="ملاحظة المراجع (اختياري)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!pending || saving}
            />
            {!pending && (
                <Badge variant={decision === 'approved' ? 'default' : 'destructive'}>
                    {decision === 'approved' ? 'مقبول' : 'مرفوض'}
                </Badge>
            )}
        </div>
    );
}
