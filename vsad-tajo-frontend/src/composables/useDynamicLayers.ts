// useDynamicLayers.ts
import { watch } from 'vue'
import { useLayersStore } from '@/stores/layersStore'
import { useMapStore } from '@/stores/mapStore'
import { MapLayerManager } from '@/mapManager/MapLayerManager'
import L from 'leaflet'

export function useDynamicLayers(map: L.Map) {
  const store = useLayersStore()
  const mapStore = useMapStore()
  const manager = new MapLayerManager(map)

  const applyPendingSelection = () => {
    const pendingSelection = mapStore.pendingFeatureSelection
    if (!pendingSelection) return false

    const selected = manager.selectFeature(pendingSelection.layerId, pendingSelection.featureId, {
      focus: pendingSelection.focus,
    })

    if (selected) {
      mapStore.clearPendingFeatureSelection()
    }

    return selected
  }

  watch(
    () => store.layers,
    async (layersState) => {
      await manager.sync(layersState)

      applyPendingSelection()
    },
    { deep: true, immediate: true }
  )

  watch(
    () => mapStore.pendingFeatureSelection?.token,
    () => {
      applyPendingSelection()
    }
  )
}
