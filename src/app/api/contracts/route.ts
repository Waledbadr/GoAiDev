import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ ok: false, error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const [contractsSnap, invoicesSnap, alertsSnap] = await Promise.all([
      adminDb.collection('contractsV2').get().catch(() => ({ docs: [] })),
      adminDb.collection('contractInvoices').get().catch(() => ({ docs: [] })),
      adminDb.collection('contractAlerts').get().catch(() => ({ docs: [] })),
    ]);

    const contracts = (contractsSnap.docs || []).map((doc: any) => {
      const data = doc.data();
      const formatVal = (v: any) => {
        if (!v) return v;
        if (typeof v.toDate === 'function') {
          return v.toDate().toISOString().split('T')[0];
        }
        if (v._seconds) {
          return new Date(v._seconds * 1000).toISOString().split('T')[0];
        }
        return v;
      };

      return {
        id: doc.id,
        ...data,
        startDate: formatVal(data.startDate) || data.startDate,
        endDate: formatVal(data.endDate) || data.endDate,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      };
    }).filter((c: any) => !c.archivedAt);

    const invoices = (invoicesSnap.docs || []).map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const alerts = (alertsSnap.docs || []).map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      ok: true,
      contracts,
      invoices,
      alerts,
    });
  } catch (error: any) {
    console.error('Error fetching contracts via API:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
