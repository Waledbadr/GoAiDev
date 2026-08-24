import { NextRequest, NextResponse } from 'next/server';
import { d1Database } from '@/lib/d1-database';

// GET /api/d1/[collection]?id=...
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ collection: string }> }
) {
  const { collection } = await context.params;
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');

  if (docId) {
    const doc = d1Database.getDocument(collection, docId);
    if (!doc) {
      return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, doc });
  }

  const docs = d1Database.getCollection(collection);
  return NextResponse.json({ ok: true, docs, count: docs.length });
}

// POST /api/d1/[collection] (Create / Overwrite)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ collection: string }> }
) {
  const { collection } = await context.params;
  try {
    const body = await req.json();
    const docId = body.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const saved = d1Database.setDocument(collection, docId, body);
    return NextResponse.json({ ok: true, id: docId, doc: saved });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/d1/[collection]?id=... (Partial Update)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ collection: string }> }
) {
  const { collection } = await context.params;
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
    return NextResponse.json({ ok: true, id: docId, doc: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/d1/[collection]?id=...
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ collection: string }> }
) {
  const { collection } = await context.params;
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('id');

  if (!docId) {
    return NextResponse.json({ ok: false, error: 'Document ID required' }, { status: 400 });
  }

  try {
    const deleted = d1Database.deleteDocument(collection, docId);
    return NextResponse.json({ ok: true, id: docId, deleted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
