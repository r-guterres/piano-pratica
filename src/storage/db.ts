// Banco IndexedDB do app. Uma camada fina sobre a API nativa: abrir/criar o
// banco e transformar requisições e transações em promessas.

export const DB_NAME = 'piano-pratica';
export const DB_VERSION = 1;

/** Stores com chave `id` dentro do registro; `kv` guarda valores avulsos por chave. */
export type RecordStore = 'scoreSessions' | 'drillRounds' | 'files';
export type StoreName = RecordStore | 'kv';

export function openDb(factory: IDBFactory, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // versão 1: criação. Novas versões acrescentam passos aqui, sem apagar dados.
      for (const store of ['scoreSessions', 'drillRounds', 'files'] as const)
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB: falha ao abrir'));
    req.onblocked = () => reject(new Error('IndexedDB: banco bloqueado por outra aba'));
  });
}

/** Executa `fn` numa transação e resolve com o resultado quando ela termina. */
export function run<T>(
  db: IDBDatabase,
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    // escrita só conta quando a transação inteira foi gravada
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error ?? new Error('IndexedDB: falha'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: transação abortada'));
  });
}
