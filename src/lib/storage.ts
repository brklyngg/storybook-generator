interface StorageAdapter {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}

class IndexedDBAdapter implements StorageAdapter {
  private dbName = 'children-book-generator';
  private version = 1;
  private storeName = 'sessions';

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async save(key: string, data: any): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        id: key,
        data,
        timestamp: Date.now(),
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async load(key: string): Promise<any> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<string[]> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }
}

class LocalStorageAdapter implements StorageAdapter {
  private prefix = 'children-book-generator:';

  async save(key: string, data: any): Promise<void> {
    try {
      const item = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (error: any) {
      throw new Error('LocalStorage save failed: ' + error.message);
    }
  }

  async load(key: string): Promise<any> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;
      
      const parsed = JSON.parse(item);
      return parsed.data;
    } catch (error) {
      console.warn('LocalStorage load failed:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }
}

export class Storage {
  private adapter: StorageAdapter;

  constructor() {
    this.adapter = this.isIndexedDBAvailable() 
      ? new IndexedDBAdapter() 
      : new LocalStorageAdapter();
  }

  private isIndexedDBAvailable(): boolean {
    try {
      return typeof indexedDB !== 'undefined';
    } catch {
      return false;
    }
  }

  async saveSession(sessionId: string, session: any): Promise<void> {
    await this.adapter.save(`session:${sessionId}`, session);
  }

  async loadSession(sessionId: string): Promise<any> {
    return await this.adapter.load(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.adapter.delete(`session:${sessionId}`);
  }

  async listSessions(): Promise<string[]> {
    const keys = await this.adapter.list();
    return keys
      .filter(key => key.startsWith('session:'))
      .map(key => key.substring('session:'.length));
  }

  async savePageCache(pageId: string, pageData: any): Promise<void> {
    await this.adapter.save(`page:${pageId}`, pageData);
  }

  async loadPageCache(pageId: string): Promise<any> {
    return await this.adapter.load(`page:${pageId}`);
  }

  async getStorageUsage(): Promise<{ used: number; available: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0,
        };
      }
    } catch (error) {
      console.warn('Storage estimation not available:', error);
    }

    return { used: 0, available: 0 };
  }

  async clearOldSessions(olderThanDays: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const sessions = await this.listSessions();
    
    for (const sessionId of sessions) {
      try {
        const session = await this.loadSession(sessionId);
        if (session && session.timestamp && session.timestamp < cutoffTime) {
          await this.deleteSession(sessionId);
        }
      } catch (error) {
        console.warn(`Error cleaning session ${sessionId}:`, error);
      }
    }
  }
}

export const storage = new Storage();