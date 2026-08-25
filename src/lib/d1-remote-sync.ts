import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Non-blocking background sync queue for remote Cloudflare D1
class D1RemoteSyncQueue {
  private queue: string[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  public enqueueSet(collectionName: string, docId: string, data: any) {
    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
    const now = new Date().toISOString();
    const sql = `INSERT INTO firestore_documents (id, collection_name, data, created_at, updated_at) VALUES ('${docId}', '${collectionName}', '${jsonStr}', '${now}', '${now}') ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at;\n`;
    this.queue.push(sql);
    this.scheduleFlush();
  }

  public enqueueDelete(collectionName: string, docId: string) {
    const sql = `DELETE FROM firestore_documents WHERE id = '${docId}';\n`;
    this.queue.push(sql);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.flushQueue();
    }, 2000); // 2 second debounce
  }

  private async flushQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const statements = this.queue.splice(0, this.queue.length);
    const tmpSqlFile = path.resolve('data_exports', `d1-sync-batch-${Date.now()}.sql`);

    try {
      const sqlContent = statements.join('\n');
      fs.writeFileSync(tmpSqlFile, sqlContent, 'utf8');

      // Run wrangler non-blocking in child process
      exec(`npx wrangler d1 execute estatecare --remote --file="${tmpSqlFile}" --yes`, { cwd: process.cwd() }, (error) => {
        try {
          if (fs.existsSync(tmpSqlFile)) fs.unlinkSync(tmpSqlFile);
        } catch {}
        if (error) {
          console.warn('[D1RemoteSync] Background sync notice:', error.message);
        }
      });
    } catch (e) {
      console.warn('[D1RemoteSync] Queue flush error:', e);
      try {
        if (fs.existsSync(tmpSqlFile)) fs.unlinkSync(tmpSqlFile);
      } catch {}
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }
}

const globalForSync = globalThis as unknown as { d1RemoteSync: D1RemoteSyncQueue };
export const d1RemoteSync = globalForSync.d1RemoteSync || new D1RemoteSyncQueue();
if (process.env.NODE_ENV !== 'production') globalForSync.d1RemoteSync = d1RemoteSync;
