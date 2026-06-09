import type { LayerState, LayerNode, TimeParams, TemporalLoadState } from '@/types/Layers'
import { defineStore } from 'pinia'
import { zonasLayers, stationLayers, meteoMaps, efasLayers } from '@/constants/itemsLayers'

// Recorre recursivamente el LAaerNode y construye un estado plano solo para nodos hoja aplicando la configuración del grupo
function buildLayerStateFromTree(
  nodes: LayerNode[],
  options: {
    defaultVisible: boolean
    defaultOpacity?: number
  },
  parentId?: string,
  accumulator: Record<string, LayerState> = {}
): Record<string, LayerState> {
  nodes.forEach((node) => {
    // Si el nodo tiene hijos, seguimos recorriendo
    if (node.children?.length) {
      buildLayerStateFromTree(node.children, options, node.id, accumulator)
    } else {
      // Es hoja → creamos estado
      accumulator[node.id] = {
        id: node.id,
        parentLayer: parentId,
        visible: options.defaultVisible,
        opacity: options.defaultOpacity ?? 1,
      }
    }
  })

  return accumulator
}

function buildInitialState(): Record<string, LayerState> {
  return {
    ...buildLayerStateFromTree(zonasLayers, {
      defaultVisible: false,
    }),
    ...buildLayerStateFromTree(stationLayers, {
      defaultVisible: true,
    }),
    ...buildLayerStateFromTree(meteoMaps, {
      defaultVisible: false,
    }),
    ...buildLayerStateFromTree(efasLayers, {
      defaultVisible: false,
    }),
  }
}

export const useLayersStore = defineStore('layers', {
  state: () => ({
    layers: buildInitialState(),
  }),

  actions: {
    toggleLayer(id: string) {
      if (!this.layers[id]) return
      this.layers[id].visible = !this.layers[id].visible
    },

    setLayerVisibility(id: string, visible: boolean) {
      if (!this.layers[id]) return
      this.layers[id].visible = visible
    },

    setOpacity(id: string, opacity: number) {
      if (this.layers[id]) {
        this.layers[id].opacity = opacity
      }
    },

    setTimeParams(id: string, params: Partial<TimeParams>) {
      const layer = this.layers[id]
      if (!layer) return

      layer.params = {
        ...layer.params,
        ...params,
      }
    },

    setTemporalLoadState(id: string, state?: Partial<TemporalLoadState>) {
      const layer = this.layers[id]
      if (!layer) return

      if (!state) {
        layer.temporalLoadState = undefined
        return
      }

      layer.temporalLoadState = {
        loading: false,
        ...layer.temporalLoadState,
        ...state,
      }
    },
  },
})
