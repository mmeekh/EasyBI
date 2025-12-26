import { ProjectState } from '../types';

const LOCAL_STATE_KEY = 'simpledash_state_v2';
const LEGACY_STATE_KEY = 'simpledash_state_v1';
const DB_NAME = 'simpledash_db';
const STORE_NAME = 'state';
const STATE_KEY = 'main';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readFromIdb = async (): Promise<ProjectState | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);

    request.onsuccess = () => resolve((request.result as ProjectState) || null);
    request.onerror = () => reject(request.error);
  });
};

const writeToIdb = async (state: ProjectState): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(state, STATE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const clearIdb = async (): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(STATE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const parseState = (raw: string | null): ProjectState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectState;
    if (!parsed || !Array.isArray(parsed.datasets) || !Array.isArray(parsed.dashboards)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const loadPersistedState = async (): Promise<ProjectState | null> => {
  if (typeof window === 'undefined') return null;

  const localState = parseState(window.localStorage.getItem(LOCAL_STATE_KEY));
  if (localState) return localState;

  const legacyState = parseState(window.localStorage.getItem(LEGACY_STATE_KEY));
  if (legacyState) return legacyState;

  try {
    return await readFromIdb();
  } catch {
    return null;
  }
};

export const savePersistedState = async (state: ProjectState): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  } catch {
    // LocalStorage might be full or blocked. We still try IndexedDB.
  }

  try {
    await writeToIdb(state);
  } catch {
    // Ignore IndexedDB errors to avoid breaking the UI.
  }
};

export const clearPersistedState = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(LOCAL_STATE_KEY);
    window.localStorage.removeItem(LEGACY_STATE_KEY);
  } catch {
    // Ignore localStorage cleanup errors.
  }

  try {
    await clearIdb();
  } catch {
    // Ignore IndexedDB cleanup errors.
  }
};
