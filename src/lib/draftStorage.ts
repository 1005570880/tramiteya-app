const STORAGE_PREFIX = 'tramiteya:draft:';

export interface DraftStorage {
  save(id: string, data: unknown): void;
  load(id: string): unknown | null;
  remove(id: string): void;
}

export const localDraftStorage: DraftStorage = {
  save(id: string, data: unknown) {
    try {
      const key = STORAGE_PREFIX + id;
      const payload = {
        savedAt: new Date().toISOString(),
        data,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      // ignore
    }
  },
  load(id: string) {
    try {
      const key = STORAGE_PREFIX + id;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      return null;
    }
  },
  remove(id: string) {
    try {
      const key = STORAGE_PREFIX + id;
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  },
};
