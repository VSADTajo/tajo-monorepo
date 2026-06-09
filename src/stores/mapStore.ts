import { defineStore } from 'pinia'

type FlyToTarget = {
  lat: number
  lng: number
  zoom?: number
  animate?: boolean
  token: number
}

type PendingFeatureSelection = {
  layerId: 'subcuencas' | 'sistemas10' | 'zonasexpl' | 'comarcasagrarias'
  featureId: string
  focus?: boolean
  token: number
}

export const useMapStore = defineStore('map', {
  state: () => ({
    flyToTarget: null as FlyToTarget | null,
    pendingFeatureSelection: null as PendingFeatureSelection | null,
  }),

  actions: {
    requestFlyTo(lat: number, lng: number, options?: { zoom?: number; animate?: boolean }) {
      this.flyToTarget = {
        lat,
        lng,
        zoom: options?.zoom,
        animate: options?.animate,
        token: Date.now(),
      }
    },

    clearFlyToTarget() {
      this.flyToTarget = null
    },

    requestFeatureSelection(
      layerId: 'subcuencas' | 'sistemas10' | 'zonasexpl' | 'comarcasagrarias',
      featureId: string,
      options?: { focus?: boolean }
    ) {
      this.pendingFeatureSelection = {
        layerId,
        featureId,
        focus: options?.focus,
        token: Date.now(),
      }
    },

    clearPendingFeatureSelection() {
      this.pendingFeatureSelection = null
    },
  },
})
