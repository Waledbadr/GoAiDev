import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveCollection(context: any): Promise<string> {
  const p = context?.params ? await context.params : null;
  return p?.collection || context?.params?.collection || '';
}

/**
 * Direct HTTP query to remote Cloudflare D1 if API token is configured
 */
async function fetchFromCloudflareD1(collectionName: string, docId?: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN;
  if (!accountId || !dbId || !token) return null;

  try {
    const sql = docId
      ? 'SELECT data FROM firestore_documents WHERE collection_name = ? AND document_id = ? LIMIT 1;'
      : 'SELECT data FROM firestore_documents WHERE collection_name = ?;';
    const params = docId ? [collectionName, docId] : [collectionName];

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.result?.[0]?.results)) {
      const parsed = json.result[0].results.map((r: any) => {
        try {
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        } catch {
          return r.data;
        }
      });
      return docId ? parsed[0] || null : parsed;
    }
  } catch (e) {
    console.warn('[api/d1] Cloudflare D1 HTTP query notice:', e);
  }
  return null;
}

// GET /api/d1/[collection]?id=...
export async function GET(req: NextRequest, context: any) {
  const collection = await resolveCollection(context);
  if (!collection) {
    return NextResponse.json({ ok: false, error: 'Collection required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');

  // Single document query
  if (docId) {
    let doc = d1Database.getDocument(collection, docId);

    // 1. Fallback: Cloudflare D1 Remote HTTP API
    if (!doc) {
      const remoteDoc = await fetchFromCloudflareD1(collection, docId);
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

  // Collection query
  let docs = d1Database.getCollection(collection);

  // If local cache has no records (e.g. on serverless environments like Vercel):
  if (!docs || docs.length === 0) {
    // 1. Fallback: Cloudflare D1 Remote HTTP API
    const remoteDocs = await fetchFromCloudflareD1(collection);
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
    if (Array.isArray(body)) {
      const count = d1Database.setDocumentsBatch(collection, body);
      if (adminDb) {
        const batch = adminDb.batch();
        body.slice(0, 500).forEach((item: any) => {
          if (item?.id) {
            const ref = adminDb.collection(collection).doc(String(item.id));
            batch.set(ref, item, { merge: true });
          }
        });
        batch.commit().catch(() => {});
      }
      return NextResponse.json({ ok: true, batch: true, count });
    }
    if (body.docs && Array.isArray(body.docs)) {
      const count = d1Database.setDocumentsBatch(collection, body.docs);
      if (adminDb) {
        const batch = adminDb.batch();
        body.docs.slice(0, 500).forEach((item: any) => {
          if (item?.id) {
            const ref = adminDb.collection(collection).doc(String(item.id));
            batch.set(ref, item, { merge: true });
          }
        });
        batch.commit().catch(() => {});
      }
      return NextResponse.json({ ok: true, batch: true, count });
    }

    const docId = body.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const saved = d1Database.setDocument(collection, docId, body);

    // Sync to Firestore Admin if present
    if (adminDb) {
      adminDb.collection(collection).doc(docId).set(saved, { merge: true }).catch(() => {});
    }

    return NextResponse.json({ ok: true, id: docId, doc: saved });
  } catch (err: any) {
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

    const adminDb = getAdminDb();
    if (adminDb) {
      adminDb.collection(collection).doc(docId).set(updated, { merge: true }).catch(() => {});
    }

    return NextResponse.json({ ok: true, id: docId, doc: updated });
  } catch (err: any) {
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

    const adminDb = getAdminDb();
    if (adminDb) {
      adminDb.collection(collection).doc(docId).delete().catch(() => {});
    }

    return NextResponse.json({ ok: true, id: docId, deleted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
