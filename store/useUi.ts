import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  /** In-memory only: an undo for the action just taken. */
  undo?: () => void;
}

interface UiState {
  toast: Toast | null;
  showToast: (message: string, undo?: () => void) => void;
  hideToast: () => void;
}

/** Transient interface state shared across screens. Never persisted. */
export const useUi = create<UiState>((set) => ({
  toast: null,
  showToast: (message, undo) => set({ toast: { id: Date.now(), message, undo } }),
  hideToast: () => set({ toast: null }),
}));
