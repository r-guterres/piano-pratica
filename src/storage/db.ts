// Banco IndexedDB do app. Uma camada fina sobre a API nativa: abrir/criar o
// banco e transformar requisições e transações em promessas.

export const DB_NAME = 'piano-pratica';
export const DB_VERSION = 2;

/** Stores com chave `id` dentro do registro; `kv` guarda valores avulsos por chave. */
export type RecordStore =
  'scoreSessions' | 'drillRounds' | 'files' | 'pedalSessions' | 'recordings';
export type StoreName = RecordStore | 'kv';

export function openDb(factory: IDBFactory, name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Cada versão só acrescenta stores (nunca apaga dados); criar o que falta
      // cobre tanto um banco novo quanto a atualização de uma versão anterior.
      //   v1: scoreSessions, drillRounds, files, kv
      //   v2: pedalSessions, recordings (M6)
      const stores = [
        'scoreSessions',
        'drillRounds',
        'files',
        'pedalSessions',
        'recordings',
      ] as const;
      for (const store of stores)
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => {
      // outra aba abrindo uma versão nova: fecha esta conexão para não travar a atualização
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
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
