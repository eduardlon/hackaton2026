import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Preferences } from '@/types';

type State = Preferences & {
  toggle: (key: keyof Preferences) => void;
  set: (key: keyof Preferences, value: boolean) => void;
};

export const usePreferencesStore = create<State>()(
  persist(
    (set, get) => ({
      paymentAlerts: true,
      aiRecommendations: true,
      biometricLogin: true,
      toggle: (key) => {
        const current = get()[key];
        set({ [key]: !current } as Partial<State>);
      },
      set: (key, value) => set({ [key]: value } as Partial<State>),
    }),
    {
      name: '@credigrow/preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
