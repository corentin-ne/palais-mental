import { create } from 'zustand';

import { CategoryId } from '@/lib/types';
import type { CatalogResult } from '@/lib/catalog';

export interface LogDraft {
  category: CategoryId;
  title: string;
  creator?: string;
  year?: number;
  coverUrl?: string;
  season?: number;
  episodeCount?: number;
  source?: CatalogResult['source'];
}

export interface Toast {
  id: number;
  message: string;
  itemId?: string;
}

interface UiState {
  /** Log flow: closed, searching (optionally scoped to a category), or confirming a draft. */
  log: { stage: 'closed' | 'search' | 'confirm'; category: CategoryId | 'all'; draft?: LogDraft };
  toast: Toast | null;
  /** Bumped on every successful log; Aero answers with a burst of bubbles. */
  celebrations: number;
  celebrate: () => void;
  openSearch: (category?: CategoryId | 'all') => void;
  setSearchCategory: (category: CategoryId | 'all') => void;
  confirm: (draft: LogDraft) => void;
  backToSearch: () => void;
  closeLog: () => void;
  showToast: (message: string, itemId?: string) => void;
  hideToast: () => void;
}

/** Transient interface state shared across tabs. Never persisted. */
export const useUiStore = create<UiState>((set) => ({
  log: { stage: 'closed', category: 'all' },
  toast: null,
  celebrations: 0,
  celebrate: () => set((s) => ({ celebrations: s.celebrations + 1 })),
  openSearch: (category = 'all') => set({ log: { stage: 'search', category } }),
  setSearchCategory: (category) => set((s) => ({ log: { ...s.log, category } })),
  confirm: (draft) => set((s) => ({ log: { ...s.log, stage: 'confirm', draft } })),
  backToSearch: () => set((s) => ({ log: { ...s.log, stage: 'search', draft: undefined } })),
  closeLog: () => set((s) => ({ log: { ...s.log, stage: 'closed' } })),
  showToast: (message, itemId) => set((s) => ({ toast: { id: Date.now(), message, itemId }, celebrations: s.celebrations + 1 })),
  hideToast: () => set({ toast: null }),
}));
