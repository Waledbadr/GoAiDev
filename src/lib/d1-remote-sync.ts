import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Queue for remote Cloudflare D1 SQL operations to prevent concurrent CLI locks
class D1RemoteSyncQueue {
  private queue: string[] = [];
  private isProcessing = false;

  public enqueueSql(sql: string) {
    this.queue.push(sql);
    this.processQueue();
  }

  public enqueueSet(collectionName: string, docId: string, data: any) {
    const jsonStr = JSON.stringify(data).replace(/'/g, "''");
    const now = new Date().toISOString();
    const sql = `INSERT INTO firestore_documents (id, collection_name, data, created_at, updated_at) VALUES ('${docId}', '${collectionName}', '${jsonStr}', '${now}', '${now}') ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at;`;
    this.enqueueSql(sql);
  }

  public enqueueDelete(collectionName: string, docId: string) {
    const sql = `DELETE FROM firestore_documents WHERE id = '${docId}';`;
    this.enqueueSql(sql);
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      // Batch up to 20 SQL statements in a single transaction
      const batch = this.queue.splice(0, 20);
      const combinedSql = batch.join(' ');

      try {
        const escapedSql = combinedSql.replace(/"/g, '\\"');
        const cmd = `npx wrangler d1 execute estatecare --remote --command="${escapedSql}"`;
        await execPromise(cmd, { cwd: process.cwd() });
      } catch (err: any) {
        console.warn('[D1RemoteSync] Remote execution notice:', err?.message || err);
      }
    }

    this.isProcessing = false;
  }
}

const globalForSync = globalThis as unknown as { d1RemoteSync: D1RemoteSyncQueue };
export const d1RemoteSync = globalForSync.d1RemoteSync || new D1RemoteSyncQueue();
if (process.env.NODE_ENV !== 'production') globalForSync.d1RemoteSync = d1RemoteSync;
