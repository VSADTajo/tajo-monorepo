export interface LayerNode {
  id: string
  title: string
  children?: LayerNode[]
  parentLayer?: string
  opacityEnabled?: boolean
  opacity?: number
}

export interface LayerState {
  id: string
  visible: boolean
  opacity: number
  parentLayer?: string
  params?: Partial<TimeParams>
  temporal?: {
    start: string
    end: string
    stepHours: number
  }
  temporalLoadState?: TemporalLoadState
}

export interface TemporalLoadState {
  requestedTime?: string
  loadedTime?: string
  loading: boolean
}

export interface TimeParams {
  time: string
  from?: string
  to?: string
  step: number
}

interface GroupBy {
  field: string
  parentLayer: string
}

interface BaseLayerConfig {
  id: string
  name: string
  url: string
  opacity?: number
  groupBy?: GroupBy
  pane?: string
  temporal?: boolean
  temporalControlMode?: 'instant' | 'range'
  start?: string
  legend?: string
  interactive?: boolean
}

export interface WMSLayerConfig extends BaseLayerConfig {
  type: 'WMS'
  layers: string
  format?: string
  styles?: string
  transparent?: boolean
  version?: string
  crs?: L.CRS
  token?: string
  crossOrigin?: boolean
  bbox?: [[number, number], [number, number]]
  mask?: string
}

export interface WFSLayerConfig extends BaseLayerConfig {
  type: 'WFS'
  typeName: string
  cql?: string
  style?: LayerStyle
  highlight?: boolean
  pointToLayer?: (feature: GeoJSON.Feature, latlng: L.LatLng) => L.Layer
}

export interface TMSLayerConfig extends BaseLayerConfig {
  type: 'TMS'
}

export interface APIStationsLayerConfig extends BaseLayerConfig {
  type: 'API_STATIONS'
  pointToLayer?: (feature: GeoJSON.Feature, latlng: L.LatLng) => L.Layer
}

export interface MeteoAccumulatedImageLayerConfig extends BaseLayerConfig {
  type: 'METEO_ACCUMULATED_IMAGE'
  variable: string
  provider: string
  chartSourceLayerId?: string
  extentProvider?: string
  extentVariable?: string
  infoPath?: string
  mapPath?: string
  imageFormat?: string
  legendUrl?: string
}

export type LayerConfig =
  | WMSLayerConfig
  | WFSLayerConfig
  | TMSLayerConfig
  | APIStationsLayerConfig
  | MeteoAccumulatedImageLayerConfig

export interface LayerStyle {
  normal: L.PathOptions
  highlight: L.PathOptions
  selected?: L.PathOptions
}
