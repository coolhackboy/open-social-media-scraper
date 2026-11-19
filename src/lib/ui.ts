import { create } from 'zustand';

interface UIState {
  settingsOpen: boolean;
  /** Section to focus when the settings dialog opens. */
  settingsFocus?: 'key';
  openSettings(focus?: 'key'): void;
  closeSettings(): void;
}

export const useUI = create<UIState>((set) => ({
  settingsOpen: false,
  openSettings: (focus) => set({ settingsOpen: true, settingsFocus: focus }),
  closeSettings: () => set({ settingsOpen: false, settingsFocus: undefined }),
}));
