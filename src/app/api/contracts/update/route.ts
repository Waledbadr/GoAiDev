import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = 'update', id, data } = body || {};

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { ok: false, error: 'Firebase Admin not configured on server' },
        { status: 500 }
      );
    }

    if (action === 'create') {
      const docRef = await adminDb.collection('contractsV2').add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return NextResponse.json({ ok: true, id: docRef.id });
    }

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      await adminDb.collection('contractsV2').doc(id).delete();
      return NextResponse.json({ ok: true });
    }

    // Default: update
    const updatePayload: Record<string, any> = {
      ...(data || {}),
      updatedAt: new Date(),
    };

    await adminDb.collection('contractsV2').doc(id).set(updatePayload, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in /api/contracts/update:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
