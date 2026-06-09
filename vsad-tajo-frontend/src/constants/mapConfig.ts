import L from 'leaflet'
import { subDays, startOfDay, format } from 'date-fns'

export const center: L.LatLngExpression = [40.2268, -4.5938]

export const defaultZoom = 9
export const defaultZoomForMobile = 7

export const minZoom = 7

export const layerStartEFAS = format(startOfDay(subDays(new Date(), 7)), "yyyy-MM-dd'T'HH:mm:ss")
