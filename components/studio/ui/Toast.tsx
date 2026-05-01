'use client';
import { create } from 'zustand';
import { nanoid } from 'nanoid';

interface ToastItem {
  id: string;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push(message: string): void;
  dismiss(id: string): void;
}

export const useToastStore = create<ToastState>()((set) => ({
  items: [],
  push: (message) => {
    const id = nanoid(6);
    set(state => ({ items: [...state.items, { id, message }] }));
    setTimeout(() => {
      set(state => ({ items: state.items.filter(t => t.id !== id) }));
    }, 2400);
  },
  dismiss: (id) => set(state => ({ items: state.items.filter(t => t.id !== id) })),
}));

export function toast(message: string) {
  useToastStore.getState().push(message);
}
