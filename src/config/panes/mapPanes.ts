import L from 'leaflet'

export const MAP_PANES = {
  BASEMAP: 'basemapPane',
  BASELAYER: 'baselayerPane',
  POLYGONS: 'polygonsPane',
  CONTORNO: 'contornoPane',
  LINES: 'linesPane',
  POINTS: 'pointsPane',
  SELECTION: 'selectionPane',
  SAIH: 'saihPane',
  REPORTING: 'reportingPane',
  AVISOS: 'avisosPane',
  HIGHLIGHT: 'highlightPane',
} as const

export function createMapPanes(map: L.Map) {
  const panes = [
    { name: MAP_PANES.BASEMAP, zIndex: 100 },
    { name: MAP_PANES.BASELAYER, zIndex: 200 },
    { name: MAP_PANES.POLYGONS, zIndex: 300 },
    { name: MAP_PANES.CONTORNO, zIndex: 300 },
    { name: MAP_PANES.LINES, zIndex: 400 },
    { name: MAP_PANES.POINTS, zIndex: 500 },
    { name: MAP_PANES.SELECTION, zIndex: 610 },
    { name: MAP_PANES.HIGHLIGHT, zIndex: 620 },
    { name: MAP_PANES.SAIH, zIndex: 650 },
    { name: MAP_PANES.REPORTING, zIndex: 650 },
    { name: MAP_PANES.AVISOS, zIndex: 300 },
  ]

  panes.forEach(({ name, zIndex }) => {
    map.createPane(name)

    const pane = map.getPane(name)
    if (pane) {
      pane.style.zIndex = String(zIndex)
    }
  })

  // Asegurar que el pane de highlight no intercepte eventos de mouse
  const highlightPane = map.getPane(MAP_PANES.HIGHLIGHT)
  if (highlightPane) {
    highlightPane.style.pointerEvents = 'none'
  }

  const selectionPane = map.getPane(MAP_PANES.SELECTION)
  if (selectionPane) {
    selectionPane.style.pointerEvents = 'none'
  }

  // Asegurar que el popup pane de Leaflet esté encima de todo
  const popupPane = map.getPane('popupPane')
  if (popupPane) {
    popupPane.style.zIndex = '800'
  }

  // Asegurar que el tooltip pane también esté alto
  const tooltipPane = map.getPane('tooltipPane')
  if (tooltipPane) {
    tooltipPane.style.zIndex = '801'
  }
}
