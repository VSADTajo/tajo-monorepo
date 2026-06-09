import { computed, ref, watch } from 'vue'
import { getFeatureContainingPoint } from '@/services/geoserver'

const geoserverTajoUrl = `${import.meta.env.VITE_GEOSERVER_URL}/Tajo/ows`

export interface LocationInfo {
  subcuenca?: string
  sistema?: string
  zona?: string
  comarca?: string
}

export function usePrecipitacionLocationInfo(initialLat: number | null, initialLng: number | null) {
  const loading = ref(false)
  const locationInfo = ref<LocationInfo>({})
  const lat = ref(initialLat)
  const lng = ref(initialLng)

  const fetchLocationInfo = async () => {
    if (lat.value === null || lng.value === null || isNaN(lat.value) || isNaN(lng.value)) {
      locationInfo.value = {}
      return
    }

    loading.value = true

    try {
      const [subcuencaFeature, sistemaFeature, zonaFeature, comarcaFeature] = await Promise.all([
        getFeatureContainingPoint(geoserverTajoUrl, 'Tajo:cht_subcuencas', lat.value, lng.value),
        getFeatureContainingPoint(
          geoserverTajoUrl,
          'Tajo:cht_sistemas10_simple',
          lat.value,
          lng.value
        ),
        getFeatureContainingPoint(
          geoserverTajoUrl,
          'Tajo:cht_zonas_expl_simple',
          lat.value,
          lng.value
        ),
        getFeatureContainingPoint(
          geoserverTajoUrl,
          'Tajo:cht_comarcasagrarias',
          lat.value,
          lng.value,
          'wkb_geometry'
        ),
      ])

      locationInfo.value = {
        subcuenca: (subcuencaFeature?.properties?.name as string) || undefined,
        sistema: (sistemaFeature?.properties?.sistema as string) || undefined,
        zona: (zonaFeature?.properties?.nombre as string) || undefined,
        comarca: (comarcaFeature?.properties?.ds_comarca as string) || undefined,
      }
    } catch (err) {
      console.error('[usePrecipitacionLocationInfo] Error fetching location info', err)
      locationInfo.value = {}
    } finally {
      loading.value = false
    }
  }

  const fetchLocationInfoWithCoords = async (newLat: number, newLng: number) => {
    lat.value = newLat
    lng.value = newLng
    await fetchLocationInfo()
  }

  watch([lat, lng], () => {
    fetchLocationInfo()
  })

  return {
    loading: computed(() => loading.value),
    locationInfo: computed(() => locationInfo.value),
    fetchLocationInfo: fetchLocationInfoWithCoords,
  }
}
