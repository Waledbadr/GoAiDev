import fs from 'fs';
import path from 'path';
import { d1RemoteSync } from './d1-remote-sync';

// Path to the primary D1 database store
const DB_DIR = path.resolve('data');
const DB_FILE = path.join(DB_DIR, 'cpc-d1-database.json');
const DUMP_FILE = path.resolve('data_exports', 'firestore-dump-complete.json');

class D1DatabaseEngine {
  private cache: Map<string, Map<string, any>> = new Map();
  private isLoaded = false;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      let sourcePath = DB_FILE;
      if (!fs.existsSync(DB_FILE) && fs.existsSync(DUMP_FILE)) {
        sourcePath = DUMP_FILE;
      }

      if (fs.existsSync(sourcePath)) {
        const raw = fs.readFileSync(sourcePath, 'utf8');
        const data: Record<string, any[]> = JSON.parse(raw);

        for (const [colName, docs] of Object.entries(data)) {
          const colMap = new Map<string, any>();
          if (Array.isArray(docs)) {
            docs.forEach((doc) => {
              if (doc && doc.id) {
                colMap.set(String(doc.id), doc);
              }
            });
          }
          this.cache.set(colName, colMap);
        }

        // Ensure saved to primary DB_FILE
        if (sourcePath !== DB_FILE) {
          this.persist();
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.error('[D1DatabaseEngine] Initialization error:', e);
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      const out: Record<string, any[]> = {};
      for (const [colName, colMap] of this.cache.entries()) {
        out[colName] = Array.from(colMap.values());
      }

      fs.writeFileSync(DB_FILE, JSON.stringify(out, null, 2), 'utf8');
    } catch (e) {
      console.error('[D1DatabaseEngine] Persist error:', e);
    }
  }

  public getCollection<T = any>(collectionName: string): T[] {
    this.ensureInitialized();
    const colMap = this.cache.get(collectionName);
    if (!colMap) return [];
    return Array.from(colMap.values()) as T[];
  }

  public getDocument<T = any>(collectionName: string, docId: string): T | null {
    this.ensureInitialized();
    const colMap = this.cache.get(collectionName);
    if (!colMap) return null;
    return (colMap.get(String(docId)) as T) || null;
  }

  public setDocument<T = any>(collectionName: string, docId: string, data: T): T {
    this.ensureInitialized();
    let colMap = this.cache.get(collectionName);
    if (!colMap) {
      colMap = new Map<string, any>();
      this.cache.set(collectionName, colMap);
    }

    const doc = {
      ...data,
      id: String(docId),
      updatedAt: new Date().toISOString(),
    };
    if (!(doc as any).createdAt) (doc as any).createdAt = new Date().toISOString();

    colMap.set(String(docId), doc);
    this.persist();
    d1RemoteSync.enqueueSet(collectionName, String(docId), doc);
    return doc as T;
  }

  public setDocumentsBatch<T = any>(collectionName: string, docs: T[]): number {
    this.ensureInitialized();
    let colMap = this.cache.get(collectionName);
    if (!colMap) {
      colMap = new Map<string, any>();
      this.cache.set(collectionName, colMap);
    }

    const now = new Date().toISOString();
    let count = 0;
    for (const item of docs) {
      if (!item) continue;
      const docId = (item as any).id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const doc = {
        ...item,
        id: String(docId),
        updatedAt: now,
      };
      if (!(doc as any).createdAt) (doc as any).createdAt = now;

      colMap.set(String(docId), doc);
      d1RemoteSync.enqueueSet(collectionName, String(docId), doc);
      count++;
    }

    this.persist();
    return count;
  }

  public updateDocument<T = any>(collectionName: string, docId: string, updates: Partial<T>): T | null {
    this.ensureInitialized();
    const colMap = this.cache.get(collectionName);
    if (!colMap || !colMap.has(String(docId))) return null;

    const existing = colMap.get(String(docId));
    const updated = {
      ...existing,
      ...updates,
      id: String(docId),
      updatedAt: new Date().toISOString(),
    };

    colMap.set(String(docId), updated);
    this.persist();
    d1RemoteSync.enqueueSet(collectionName, String(docId), updated);
    return updated as T;
  }

  public deleteDocument(collectionName: string, docId: string): boolean {
    this.ensureInitialized();
    const colMap = this.cache.get(collectionName);
    if (!colMap) return false;
    const deleted = colMap.delete(String(docId));
    if (deleted) {
      this.persist();
      d1RemoteSync.enqueueDelete(collectionName, String(docId));
    }
    return deleted;
  }

  public count(collectionName: string): number {
    this.ensureInitialized();
    return this.cache.get(collectionName)?.size || 0;
  }
}

// Global instance
export const d1Database = new D1DatabaseEngine();
