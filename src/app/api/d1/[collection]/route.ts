import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  fetchDocsFromD1,
  saveDocToD1,
  saveBatchToD1,
  deleteDocFromD1,
} from '@/lib/cloudflare-d1-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveCollection(context: any): Promise<string> {
  const p = context?.params ? await context.params : null;
  return p?.collection || context?.params?.collection || '';
}

// GET /api/d1/[collection]?id=...&startDate=...&endDate=...
export async function GET(req: NextRequest, context: any) {
  const collection = await resolveCollection(context);
  if (!collection) {
    return NextResponse.json({ ok: false, error: 'Collection required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Single document query
  if (docId) {
    let doc = d1Database.getDocument(collection, docId);

    // 1. Fallback: Cloudflare D1 Remote HTTP API
    if (!doc) {
      const remoteDoc = await fetchDocsFromD1(collection, { docId });
      if (remoteDoc) {
        doc = remoteDoc;
        d1Database.setDocument(collection, docId, doc);
      }
    }

    // 2. Fallback: Firestore Admin SDK
    if (!doc) {
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          const snap = await adminDb.collection(collection).doc(docId).get();
          if (snap.exists) {
            doc = { id: snap.id, ...snap.data() };
            d1Database.setDocument(collection, docId, doc);
          }
        } catch (e) {
          console.warn(`[api/d1] Firestore fallback doc error for ${collection}/${docId}:`, e);
        }
      }
    }

    if (!doc) {
      return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, doc });
  }

  // Collection query (with optional date filtering)
  let docs = d1Database.getCollection(collection);

  // If local in-memory DB is empty (common in serverless cold starts on Vercel)
  if (!docs || docs.length === 0) {
    // 1. Fallback: Cloudflare D1 Remote HTTP API
    const remoteDocs = await fetchDocsFromD1(collection, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    if (remoteDocs && remoteDocs.length > 0) {
      docs = remoteDocs;
      // If full collection without date filters, cache locally
      if (!startDate && !endDate) {
        d1Database.setDocumentsBatch(collection, docs);
      }
    } else {
      // 2. Fallback: Firestore Admin SDK
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          let q: any = adminDb.collection(collection);
          if (startDate) q = q.where('date', '>=', startDate);
          if (endDate) q = q.where('date', '<=', endDate);
          const snap = await q.get();
          if (!snap.empty) {
            docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            if (!startDate && !endDate) {
              d1Database.setDocumentsBatch(collection, docs);
            }
          }
        } catch (e) {
          console.warn(`[api/d1] Firestore fallback collection error for ${collection}:`, e);
        }
      }
    }
  } else if (startDate || endDate) {
    // If local collection had records, apply date filtering locally
    docs = docs.filter((item: any) => {
      const d = item?.date;
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  return NextResponse.json({ ok: true, docs: docs || [], count: docs?.length || 0 });
}

// POST /api/d1/[collection] (Create / Overwrite / Batch)
export async function POST(req: NextRequest, context: any) {
  const collection = await resolveCollection(context);
  if (!collection) {
    return NextResponse.json({ ok: false, error: 'Collection required' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const adminDb = getAdminDb();

    // Check if batch payload
    const isBatch = Array.isArray(body) || (body.docs && Array.isArray(body.docs));
    const docsToSave: any[] = Array.isArray(body) ? body : body.docs && Array.isArray(body.docs) ? body.docs : null;

    if (isBatch && docsToSave) {
      // 1. Update in-memory / local SQLite
      const count = d1Database.setDocumentsBatch(collection, docsToSave);

      // 2. Direct HTTP sync to Cloudflare D1 (Awaited for Vercel/serverless environments)
      await saveBatchToD1(collection, docsToSave);

      // 3. Sync to Firestore Admin if present (Chunked to respect 500-doc limit, awaited)
      if (adminDb) {
        try {
          const CHUNK_SIZE = 500;
          for (let i = 0; i < docsToSave.length; i += CHUNK_SIZE) {
            const chunk = docsToSave.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();
            chunk.forEach((item: any) => {
              if (item?.id) {
                const ref = adminDb.collection(collection).doc(String(item.id));
                batch.set(ref, item, { merge: true });
              }
            });
            await batch.commit();
          }
        } catch (adminErr) {
          console.warn(`[api/d1] Firestore batch write error for ${collection}:`, adminErr);
        }
      }

      return NextResponse.json({ ok: true, batch: true, count });
    }

    // Single Document Save
    const docId = body.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const saved = d1Database.setDocument(collection, docId, body);

    // 2. Direct HTTP sync to Cloudflare D1 (Awaited)
    await saveDocToD1(collection, docId, saved);

    // 3. Sync to Firestore Admin if present (Awaited)
    if (adminDb) {
      try {
        await adminDb.collection(collection).doc(docId).set(saved, { merge: true });
      } catch (adminErr) {
        console.warn(`[api/d1] Firestore doc write error for ${collection}/${docId}:`, adminErr);
      }
    }

    return NextResponse.json({ ok: true, id: docId, doc: saved });
  } catch (err: any) {
    console.error(`[api/d1] POST error in ${collection}:`, err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/d1/[collection]?id=... (Partial Update)
export async function PATCH(req: NextRequest, context: any) {
  const collection = await resolveCollection(context);
  if (!collection) {
    return NextResponse.json({ ok: false, error: 'Collection required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');

  if (!docId) {
    return NextResponse.json({ ok: false, error: 'Document ID required' }, { status: 400 });
  }

  try {
    const updates = await req.json();
    const updated = d1Database.updateDocument(collection, docId, updates);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
    }

    // 1. Direct HTTP sync to Cloudflare D1 (Awaited)
    await saveDocToD1(collection, docId, updated);

    // 2. Sync to Firestore Admin if present (Awaited)
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb.collection(collection).doc(docId).set(updated, { merge: true });
      } catch (adminErr) {
        console.warn(`[api/d1] Firestore patch error for ${collection}/${docId}:`, adminErr);
      }
    }

    return NextResponse.json({ ok: true, id: docId, doc: updated });
  } catch (err: any) {
    console.error(`[api/d1] PATCH error in ${collection}:`, err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/d1/[collection]?id=...
export async function DELETE(req: NextRequest, context: any) {
  const collection = await resolveCollection(context);
  if (!collection) {
    return NextResponse.json({ ok: false, error: 'Collection required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');

  if (!docId) {
    return NextResponse.json({ ok: false, error: 'Document ID required' }, { status: 400 });
  }

  try {
    const deleted = d1Database.deleteDocument(collection, docId);

    // 1. Direct HTTP delete in Cloudflare D1 (Awaited)
    await deleteDocFromD1(collection, docId);

    // 2. Sync delete to Firestore Admin if present (Awaited)
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb.collection(collection).doc(docId).delete();
      } catch (adminErr) {
        console.warn(`[api/d1] Firestore delete error for ${collection}/${docId}:`, adminErr);
      }
    }

    return NextResponse.json({ ok: true, id: docId, deleted });
  } catch (err: any) {
    console.error(`[api/d1] DELETE error in ${collection}:`, err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
