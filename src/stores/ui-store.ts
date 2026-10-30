import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  density: 'comfortable' | 'compact'
  setDensity: (density: 'comfortable' | 'compact') => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      density: 'comfortable',
      setDensity: (density) => set({ density }),
    }),
    { name: 'vfxt-ui' },
  ),
)
