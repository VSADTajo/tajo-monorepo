type BoundaryData = {
  geojson: GeoJSON.FeatureCollection
  bbox: [[number, number], [number, number]]
}

export const boundaryStore: Record<string, BoundaryData> = {}

type BoundaryListener = (data: BoundaryData) => void

const boundaryListeners: Record<string, Set<BoundaryListener>> = {}

export function setBoundary(id: string, data: BoundaryData) {
  boundaryStore[id] = data

  const listeners = boundaryListeners[id]
  if (!listeners) return

  listeners.forEach((listener) => listener(data))
}

export function onBoundaryReady(id: string, listener: BoundaryListener): () => void {
  const existing = boundaryStore[id]
  if (existing) {
    listener(existing)
    return () => {}
  }

  if (!boundaryListeners[id]) {
    boundaryListeners[id] = new Set()
  }

  boundaryListeners[id].add(listener)

  return () => {
    boundaryListeners[id]?.delete(listener)
  }
}
