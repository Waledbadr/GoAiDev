import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  fetchDocsFromD1,
  saveDocToD1,
  saveBatchToD1,
  deleteDocFromD1,
  executeD1Query,
  getCloudflareD1Config,
} from '@/lib/cloudflare-d1-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds serverless timeout for high-throughput batching

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
      return NextResponse.json({ ok: true, doc: null, error: 'Document not found' });
    }
    return NextResponse.json({ ok: true, doc });
  }

  // 1. If date filtering is requested (common for timesheet & attendance):
  // Check Cloudflare D1 first because local seed data might only have older historical months
  if (startDate || endDate) {
    // A. Check Cloudflare D1
    const remoteDocs = await fetchDocsFromD1(collection, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    if (remoteDocs && remoteDocs.length > 0) {
      return NextResponse.json({ ok: true, docs: remoteDocs, count: remoteDocs.length, source: 'd1' });
    }

    // B. Check Firestore Admin
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        let q: any = adminDb.collection(collection);
        if (startDate) q = q.where('date', '>=', startDate);
        if (endDate) q = q.where('date', '<=', endDate);
        const snap = await q.get();
        if (!snap.empty) {
          const firestoreDocs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          return NextResponse.json({ ok: true, docs: firestoreDocs, count: firestoreDocs.length, source: 'firestore' });
        }
      } catch (e) {
        console.warn(`[api/d1] Firestore fallback collection error for ${collection}:`, e);
      }
    }

    // C. Fallback: Local in-memory DB filtered by date
    let localDocs = d1Database.getCollection(collection);
    localDocs = localDocs.filter((item: any) => {
      const d = item?.date;
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    return NextResponse.json({ ok: true, docs: localDocs || [], count: localDocs?.length || 0, source: 'local' });
  }

  // Collection query without date filters
  let docs = d1Database.getCollection(collection);

  // If local in-memory DB is empty or running serverless on Vercel, check remote persistent stores
  const isVercelEnv = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!docs || docs.length === 0 || isVercelEnv) {
    // 1. Cloudflare D1 Remote HTTP API
    const remoteDocs = await fetchDocsFromD1(collection);

    if (remoteDocs && remoteDocs.length > 0) {
      docs = remoteDocs;
      d1Database.setDocumentsBatch(collection, docs);
    } else {
      // 2. Fallback: Firestore Admin SDK
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          const snap = await adminDb.collection(collection).get();
          if (!snap.empty) {
            docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            d1Database.setDocumentsBatch(collection, docs);
          }
        } catch (e) {
          console.warn(`[api/d1] Firestore fallback collection error for ${collection}:`, e);
        }
      }
    }
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
      // 1. Update in-memory cache
      d1Database.setDocumentsBatch(collection, docsToSave);

      // 2. Direct HTTP sync to Cloudflare D1
      let d1SavedCount = 0;
      try {
        d1SavedCount = await saveBatchToD1(collection, docsToSave);
      } catch (d1Err: any) {
        console.warn(`[api/d1] Cloudflare D1 batch save notice for ${collection}:`, d1Err.message || d1Err);
      }

      // 3. Sync to Firestore Admin if present (Chunked to respect 500-doc limit)
      let firestoreSavedCount = 0;
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
            firestoreSavedCount += chunk.length;
          }
        } catch (adminErr) {
          console.warn(`[api/d1] Firestore batch write notice for ${collection}:`, adminErr);
        }
      }

      // 4. Persistence verification on Vercel:
      const isVercelEnv = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isVercelEnv && d1SavedCount === 0 && firestoreSavedCount === 0) {
        const hasCfConfig = !!getCloudflareD1Config();
        const hasAdminConfig = !!adminDb;
        if (!hasCfConfig && !hasAdminConfig) {
          return NextResponse.json({
            ok: false,
            error: 'قاعدة البيانات غير مهيأة على Vercel: يرجى إضافة CLOUDFLARE_API_TOKEN أو بيانات FIREBASE_ADMIN في متغيرات بيئة Vercel لحفظ السجلات بصورة دائمة.',
            requiresConfig: true,
          }, { status: 500 });
        }
      }

      return NextResponse.json({
        ok: true,
        batch: true,
        count: docsToSave.length,
        d1Saved: d1SavedCount,
        firestoreSaved: firestoreSavedCount,
      });
    }

    // Single Document Save
    const docId = body.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const saved = d1Database.setDocument(collection, docId, body);

    // 2. Direct HTTP sync to Cloudflare D1
    let d1Saved = false;
    try {
      d1Saved = await saveDocToD1(collection, docId, saved);
    } catch {}

    // 3. Sync to Firestore Admin if present
    let firestoreSaved = false;
    if (adminDb) {
      try {
        await adminDb.collection(collection).doc(docId).set(saved, { merge: true });
        firestoreSaved = true;
      } catch (adminErr) {
        console.warn(`[api/d1] Firestore doc write error for ${collection}/${docId}:`, adminErr);
      }
    }

    return NextResponse.json({ ok: true, id: docId, doc: saved, d1Saved, firestoreSaved });
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

    // 1. Direct HTTP sync to Cloudflare D1
    await saveDocToD1(collection, docId, updated);

    // 2. Sync to Firestore Admin if present
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

// DELETE /api/d1/[collection]?id=... OR /api/d1/[collection]?clearAll=true
export async function DELETE(req: NextRequest, context: any) {
  const collection = await resolveCollection(context);
  if (!collection) {
    return NextResponse.json({ ok: false, error: 'Collection required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');
  const clearAll = searchParams.get('clearAll') === 'true';

  try {
    if (clearAll) {
      // 1. Clear in-memory
      d1Database.saveCollection(collection, []);

      // 2. Clear in Cloudflare D1
      await executeD1Query('DELETE FROM firestore_documents WHERE collection_name = ?;', [collection]);

      // 3. Clear in Firestore Admin
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          const snap = await adminDb.collection(collection).get();
          const batch = adminDb.batch();
          snap.docs.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        } catch (adminErr) {
          console.warn(`[api/d1] Firestore clear error for ${collection}:`, adminErr);
        }
      }

      return NextResponse.json({ ok: true, cleared: true, collection });
    }

    if (!docId) {
      return NextResponse.json({ ok: false, error: 'Document ID or clearAll required' }, { status: 400 });
    }

    const deleted = d1Database.deleteDocument(collection, docId);

    // 1. Direct HTTP delete in Cloudflare D1
    await deleteDocFromD1(collection, docId);

    // 2. Sync delete to Firestore Admin if present
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
