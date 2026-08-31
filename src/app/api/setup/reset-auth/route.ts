import { NextRequest, NextResponse } from 'next/server';

declare const require: any;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getProjectIdFallback(): string | undefined {
  try {
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (process.env.FIREBASE_CONFIG) {
      const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
      if (cfg.projectId) return cfg.projectId;
    }
  } catch {}
  return undefined;
}

function initAdmin() {
  const admin = require('firebase-admin');
  if (admin.apps.length) return admin;
  try {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (b64 || svc) {
      const jsonStr = b64
        ? Buffer.from(b64, 'base64').toString('utf8')
        : (typeof svc === 'string' ? svc : JSON.stringify(svc));
      const credentials = JSON.parse(jsonStr);
      admin.initializeApp({
        credential: admin.credential.cert(credentials as any),
        projectId: (credentials as any).project_id || getProjectIdFallback(),
      });
      return admin;
    }
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: getProjectIdFallback(),
    } as any);
    return admin;
  } catch (e) {
    console.error('firebase-admin init failed', e);
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = initAdmin();
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          ok: false,
          error: 'RESET_AUTH_DISABLED_IN_PRODUCTION',
        },
        { status: 200 }
      );
    }

    const { keepEmails, password, secret } = await req.json();
    const providedSecret = secret || password;
    const requiredSecret = process.env.RESET_AUTH_SECRET || process.env.SETUP_SECRET;

    // Verify secret or admin authorization token
    let isAuthorized = false;

    if (requiredSecret && providedSecret === requiredSecret) {
      isAuthorized = true;
    } else {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';
      if (token) {
        try {
          const decoded = await admin.auth().verifyIdToken(token);
          const db = admin.firestore();
          const requesterDoc = await db.doc(`users/${decoded.uid}`).get();
          if (requesterDoc.exists && (requesterDoc.data() as any)?.role === 'Admin') {
            isAuthorized = true;
          }
        } catch {}
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const auth = admin.auth();

    const keep = new Set<string>((keepEmails || []).map((e: string) => String(e || '').trim().toLowerCase()));

  let deleted = 0, kept = 0;
  const keptUsers: { email: string; uid: string }[] = [];
    const MAX_PER_PAGE = 1000;
    let nextPageToken: string | undefined = undefined;

    do {
      const listResult: any = await auth.listUsers(MAX_PER_PAGE, nextPageToken);
      for (const u of listResult.users) {
        const email = String(u.email || '').trim().toLowerCase();
        if (keep.has(email)) { kept++; keptUsers.push({ email, uid: u.uid }); continue; }
        await auth.deleteUser(u.uid);
        deleted++;
      }
      nextPageToken = listResult.pageToken || undefined;
    } while (nextPageToken);

  return NextResponse.json({ deleted, kept, keptUsers });
  } catch (e: any) {
    console.error('reset-auth error', e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
