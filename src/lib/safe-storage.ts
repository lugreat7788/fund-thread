type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key' | 'length'>;

const memory = new Map<string, string>();

const memoryStorage: StorageLike = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null;
  },
  key(index: number) {
    return Array.from(memory.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memory.delete(key);
  },
  setItem(key: string, value: string) {
    memory.set(key, String(value));
  },
};

let activeStorage: StorageLike = memoryStorage;

function canUseStorage(candidate: Storage | undefined): candidate is Storage {
  if (!candidate) return false;
  try {
    const testKey = '__lovable_storage_test__';
    candidate.setItem(testKey, '1');
    candidate.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function installSafeLocalStorage() {
  if (typeof window === 'undefined') {
    activeStorage = memoryStorage;
    return activeStorage;
  }

  if (canUseStorage(window.localStorage)) {
    activeStorage = window.localStorage;
    return activeStorage;
  }

  activeStorage = memoryStorage;

  try {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    });
  } catch {
    // Safari iframe / privacy mode may block overriding as well; callers still use memory fallback.
  }

  return activeStorage;
}

export const safeStorage = {
  getItem(key: string) {
    try {
      return activeStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      activeStorage.setItem(key, value);
    } catch {
      // no-op fallback for blocked storage contexts
    }
  },
  removeItem(key: string) {
    try {
      activeStorage.removeItem(key);
    } catch {
      // no-op fallback for blocked storage contexts
    }
  },
  clear() {
    try {
      activeStorage.clear();
    } catch {
      // no-op fallback for blocked storage contexts
    }
  },
};

installSafeLocalStorage();