/**
 * Cloudflare D1 Client Adapter
 * Drop-in client for reading and writing collections to D1 with caching and error resilience.
 */

export interface D1Document {
  id: string;
  [key: string]: any;
}

export const d1Client = {
  /**
   * Fetch all documents in a collection
   */
  async getDocs<T = D1Document>(collectionName: string): Promise<T[]> {
    try {
      const res = await fetch(`/api/d1/${collectionName}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.docs)) {
        return json.docs as T[];
      }
      return [];
    } catch (err) {
      console.warn(`[d1Client.getDocs] Error fetching ${collectionName}:`, err);
      return [];
    }
  },

  /**
   * Fetch a single document by ID
   */
  async getDoc<T = D1Document>(collectionName: string, docId: string): Promise<T | null> {
    try {
      const res = await fetch(`/api/d1/${collectionName}?id=${encodeURIComponent(docId)}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.ok && json.doc) {
        return json.doc as T;
      }
      return null;
    } catch (err) {
      console.warn(`[d1Client.getDoc] Error fetching ${collectionName}/${docId}:`, err);
      return null;
    }
  },

  /**
   * Create or replace a document
   */
  async setDoc<T = any>(collectionName: string, docId: string, data: T): Promise<string> {
    const res = await fetch(`/api/d1/${collectionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, id: docId }),
    });
    if (!res.ok) throw new Error(`Failed to save to D1 (${res.status})`);
    const json = await res.json();
    return json.id || docId;
  },

  /**
   * Add a new document with auto-generated ID
   */
  async addDoc<T = any>(collectionName: string, data: T): Promise<string> {
    const res = await fetch(`/api/d1/${collectionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to add to D1 (${res.status})`);
    const json = await res.json();
    return json.id;
  },

  /**
   * Update a document partially
   */
  async updateDoc<T = any>(collectionName: string, docId: string, updates: Partial<T>): Promise<void> {
    const res = await fetch(`/api/d1/${collectionName}?id=${encodeURIComponent(docId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update in D1 (${res.status})`);
  },

  /**
   * Delete a document
   */
  async deleteDoc(collectionName: string, docId: string): Promise<void> {
    const res = await fetch(`/api/d1/${collectionName}?id=${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete from D1 (${res.status})`);
  },
};
