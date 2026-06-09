import { defineStore } from 'pinia'
import { getAvisosByTipoService } from '@/services/avisos'

function getCurrentSixHourIntervalStart(date = new Date()): string {
  const next = new Date(date)
  next.setMinutes(0, 0, 0)
  next.setHours(Math.floor(next.getHours() / 6) * 6)
  return next.toISOString()
}

export interface AvisoFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: unknown[]
  }
  properties: Record<string, unknown>
}

type AvisosApiResponse = AvisoFeature[] | { features: AvisoFeature[] } | AvisoFeature

function filterAvisos(features: AvisoFeature[]): AvisoFeature[] {
  return features.filter((feature) => {
    const language = String(feature.properties?.language ?? '')
      .toLowerCase()
      .replace('_', '-')

    const isEnglishVariant = language === 'en-gb'

    return !isEnglishVariant
  })
}

export const useAvisosStore = defineStore('avisos', {
  state: () => ({
    selectedTipo: null as string | null,
    selectedIntervalStart: getCurrentSixHourIntervalStart(),
    avisos: [] as AvisoFeature[],
    selectedAvisoId: null as string | null,
    loading: false,
  }),

  actions: {
    setSelectedInterval(startIso: string) {
      this.selectedIntervalStart = startIso
    },

    selectAvisoFeature(identifier: string) {
      this.selectedAvisoId = identifier
    },

    toggleAvisoFeature(identifier: string) {
      this.selectedAvisoId = this.selectedAvisoId === identifier ? null : identifier
    },

    clearSelectedAvisoFeature() {
      this.selectedAvisoId = null
    },

    clearSelectedAviso() {
      this.selectedTipo = null
      this.avisos = []
      this.selectedAvisoId = null
      this.loading = false
      this.selectedIntervalStart = getCurrentSixHourIntervalStart()
    },

    async selectAviso(tipo: string) {
      this.selectedTipo = tipo
      this.selectedIntervalStart = getCurrentSixHourIntervalStart()
      this.selectedAvisoId = null
      this.loading = true

      try {
        const response = (await getAvisosByTipoService(tipo)) as AvisosApiResponse | null

        console.log('[avisosStore] Raw response:', response)

        // Ensure response is an array of Features
        if (Array.isArray(response)) {
          this.avisos = filterAvisos(response as AvisoFeature[])
          console.log('[avisosStore] Response is array, avisos count:', this.avisos.length)
        } else if (response && typeof response === 'object' && 'features' in response) {
          this.avisos = filterAvisos(response.features)
          console.log(
            '[avisosStore] Response is FeatureCollection, avisos count:',
            this.avisos.length
          )
        } else if (response && typeof response === 'object') {
          // Si es un objeto simple, tratarlo como un Feature único
          this.avisos = filterAvisos([response as AvisoFeature])
          console.log('[avisosStore] Response is single Feature')
        } else {
          this.avisos = []
          console.warn('[avisosStore] Unexpected response type:', typeof response)
        }

        console.log(`[avisosStore] tipo=${tipo}, avisos stored:`, this.avisos)
      } catch (error) {
        this.avisos = []
        console.error(`[avisosStore] error tipo=${tipo}`, error)
      } finally {
        this.loading = false
      }
    },
  },
})
