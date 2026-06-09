export const basemapsLayers = [
  {
    id: 'ign-es',
    name: 'IGN',
    preview:
      'https://www.ign.es/wmts/ign-base?request=GetTile&service=WMTS&Version=1.0.0&Layer=IGNBaseTodo&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix=6&TileCol=30&TileRow=24',
    url: 'https://www.ign.es/wmts/ign-base?request=GetTile&service=WMTS&Version=1.0.0&Layer=IGNBaseTodo&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileCol={x}&TileRow={y}',
    attribution: '&copy; Instituto Geográfico Nacional de España',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    preview: 'https://tile.openstreetmap.org/10/511/340.png',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  {
    id: 'esri',
    name: 'Satélite',
    preview:
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/340/511',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  {
    id: 'carto-dark',
    name: 'Oscuro',
    preview: 'https://a.basemaps.cartocdn.com/dark_all/10/511/340.png',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  {
    id: 'carto-light',
    name: 'Claro',
    preview: 'https://a.basemaps.cartocdn.com/light_all/10/511/340.png',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  {
    id: 'wikimedia',
    name: 'Wikimedia',
    preview: 'https://maps.wikimedia.org/osm-intl/10/511/340.png',
    url: 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png',
    attribution: '&copy; Wikimedia',
  },
]
