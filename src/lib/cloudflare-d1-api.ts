/**
 * Cloudflare D1 Remote HTTP REST API Client
 * Enables direct read/write operations from any serverless environment (Vercel, AWS Lambda, Node.js)
 * without requiring the local Wrangler CLI.
 */

export interface CloudflareD1Config {
  accountId: string;
  dbId: string;
  token: string;
}

export function getCloudflareD1Config(): CloudflareD1Config | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN;

  if (!accountId || !dbId || !token) {
    return null;
  }
  return { accountId, dbId, token };
}

export async function executeD1Query<T = any>(sql: string, params: any[] = []): Promise<T[] | null> {
  const cfg = getCloudflareD1Config();
  if (!cfg) return null;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.dbId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[Cloudflare D1 HTTP] Query failed (${res.status}):`, errText);
      return null;
    }

    const json = await res.json();
    if (json.success && Array.isArray(json.result?.[0]?.results)) {
      return json.result[0].results as T[];
    }
    return null;
  } catch (err) {
    console.warn('[Cloudflare D1 HTTP] Query execution error:', err);
    return null;
  }
}

export async function fetchDocsFromD1(
  collectionName: string,
  options?: { docId?: string; startDate?: string; endDate?: string }
): Promise<any> {
  const cfg = getCloudflareD1Config();
  if (!cfg) return null;

  try {
    let sql: string;
    let params: any[];

    if (options?.docId) {
      sql = 'SELECT data FROM firestore_documents WHERE collection_name = ? AND document_id = ? LIMIT 1;';
      params = [collectionName, options.docId];
    } else if (options?.startDate && options?.endDate) {
      sql = `SELECT data FROM firestore_documents WHERE collection_name = ? AND json_extract(data, '$.date') >= ? AND json_extract(data, '$.date') <= ?;`;
      params = [collectionName, options.startDate, options.endDate];
    } else {
      sql = 'SELECT data FROM firestore_documents WHERE collection_name = ?;';
      params = [collectionName];
    }

    const rows = await executeD1Query<{ data: string | any }>(sql, params);
    if (!rows) return null;

    const parsed = rows.map((r) => {
      try {
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      } catch {
        return r.data;
      }
    });

    return options?.docId ? parsed[0] || null : parsed;
  } catch (err) {
    console.warn('[Cloudflare D1 HTTP] Fetch docs error:', err);
    return null;
  }
}

export async function saveDocToD1(collectionName: string, docId: string, data: any): Promise<boolean> {
  const cfg = getCloudflareD1Config();
  if (!cfg) return false;

  try {
    const jsonStr = JSON.stringify(data);
    const sql = `INSERT OR REPLACE INTO firestore_documents (collection_name, document_id, data) VALUES (?, ?, ?);`;
    const result = await executeD1Query(sql, [collectionName, String(docId), jsonStr]);
    return result !== null;
  } catch (err) {
    console.warn(`[Cloudflare D1 HTTP] Error saving doc ${collectionName}/${docId}:`, err);
    return false;
  }
}

export async function saveBatchToD1(collectionName: string, docs: any[]): Promise<number> {
  const cfg = getCloudflareD1Config();
  if (!cfg || !docs || docs.length === 0) return 0;

  // Chunk docs into batches of 50 to comfortably stay below SQLite parameter limits
  const CHUNK_SIZE = 50;
  let totalSaved = 0;

  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];

    for (const item of chunk) {
      if (!item) continue;
      const docId = item.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      valuePlaceholders.push('(?, ?, ?)');
      params.push(collectionName, String(docId), JSON.stringify(item));
    }

    if (valuePlaceholders.length === 0) continue;

    const sql = `INSERT OR REPLACE INTO firestore_documents (collection_name, document_id, data) VALUES ${valuePlaceholders.join(', ')};`;
    const res = await executeD1Query(sql, params);
    if (res !== null) {
      totalSaved += chunk.length;
    }
  }

  return totalSaved;
}

export async function deleteDocFromD1(collectionName: string, docId: string): Promise<boolean> {
  const cfg = getCloudflareD1Config();
  if (!cfg) return false;

  try {
    const sql = `DELETE FROM firestore_documents WHERE collection_name = ? AND document_id = ?;`;
    const result = await executeD1Query(sql, [collectionName, String(docId)]);
    return result !== null;
  } catch (err) {
    console.warn(`[Cloudflare D1 HTTP] Error deleting doc ${collectionName}/${docId}:`, err);
    return false;
  }
}
