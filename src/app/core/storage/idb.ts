/**
 * A tiny promise wrapper over IndexedDB.
 *
 * Deliberately dependency-free: the app only needs two object stores, and a
 * generic library would cost more bytes than the 80 lines below.
 */

export interface IdbSchema {
  readonly name: string;
  readonly version: number;
  readonly upgrade: (db: IDBDatabase, from: number) => void;
}

export function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IdbDatabase {
  #db: Promise<IDBDatabase> | null = null;

  constructor(private readonly schema: IdbSchema) {}

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.schema.name, this.schema.version);
      request.onupgradeneeded = (event) => this.schema.upgrade(request.result, event.oldVersion);
      request.onsuccess = () => {
        // A newer tab bumped the schema: close so it is not blocked.
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
    });
    return this.#db;
  }

  async run<T>(
    store: string,
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
  ): Promise<T> {
    const db = await this.#open();
    const tx = db.transaction(store, mode);
    const result = work(tx.objectStore(store));
    const value = result instanceof Promise ? await result : await toPromise(result);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return value;
  }

  getAll<T>(store: string): Promise<T[]> {
    return this.run(store, 'readonly', (s) => toPromise(s.getAll() as IDBRequest<T[]>));
  }

  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return this.run(store, 'readonly', (s) => toPromise(s.get(key) as IDBRequest<T | undefined>));
  }

  put<T>(store: string, value: T, key?: IDBValidKey): Promise<void> {
    return this.run(store, 'readwrite', async (s) => {
      await toPromise(s.put(value as never, key));
    });
  }

  putAll<T>(store: string, values: readonly T[]): Promise<void> {
    return this.run(store, 'readwrite', async (s) => {
      await Promise.all(values.map((value) => toPromise(s.put(value as never))));
    });
  }

  delete(store: string, key: IDBValidKey): Promise<void> {
    return this.run(store, 'readwrite', async (s) => {
      await toPromise(s.delete(key));
    });
  }

  clear(store: string): Promise<void> {
    return this.run(store, 'readwrite', async (s) => {
      await toPromise(s.clear());
    });
  }
}
