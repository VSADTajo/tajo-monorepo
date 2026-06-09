<template>
  <div ref="mapContainerDetail" class="map-container border-md"></div>
</template>

<script lang="ts" setup>
  import { useBasemap } from '@/composables/useBasemaps'
  import L from 'leaflet'
  import { center, defaultZoom, minZoom } from '@/constants/mapConfig'
  import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
  import { createMapPanes } from '@/config/panes/mapPanes'
  import { basemapsLayers } from '@/constants/basemaps'
  import { dynamicLayersConfig } from '@/config/layers.config'
  import { getWFSFeatureById } from '@/services/geoserver'
  import {
    saihPointStyle,
    subcuencasStyle,
    sistemas10Style,
    zonasexplStyle,
    comarcasagrariasStyle,
  } from '@/config/styles/layerStyles'
  import { useRoute } from 'vue-router'
  import type { WFSLayerConfig } from '@/types/Layers'
  import type { StationData } from '@/utils/stationsToGeoJSON'
  import { stationsToGeoJSON } from '@/utils/stationsToGeoJSON'
  import { buildSaihPopupContent } from '@/utils/saihStations'

  const props = defineProps<{
    type: 'subcuencas' | 'sistemas10' | 'zonasexpl' | 'comarcasagrarias'
    stations?: StationData[]
    selectedStationCode?: string | null
  }>()

  const emit = defineEmits<{
    (e: 'update:selectedStationCode', value: string | null): void
  }>()

  const route = useRoute()

  const mapContainerDetail = ref<HTMLElement | null>(null)
  const map = shallowRef<L.Map | null>(null)
  let polygonLayer: L.GeoJSON | null = null
  let stationsLayer: L.GeoJSON | null = null

  const { selectedBasemap } = useBasemap()

  function clearStationsLayer() {
    if (!map.value || !stationsLayer) return

    map.value.removeLayer(stationsLayer)
    stationsLayer = null
  }

  function renderStationsLayer() {
    if (!map.value) return

    clearStationsLayer()

    const stationItems = Array.isArray(props.stations) ? props.stations : []
    if (!stationItems.length) return

    const geojson = stationsToGeoJSON(stationItems)

    const selectedCode = props.selectedStationCode

    stationsLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const marker = saihPointStyle(feature as GeoJSON.Feature, latlng)
        const featureCode = String(
          (feature.properties as Record<string, unknown>)?.stationCode ?? ''
        )
        if (selectedCode && featureCode === selectedCode) {
          marker.on('add', () => {
            marker
              .getElement()
              ?.querySelector('.saih-marker')
              ?.classList.add('saih-marker--selected')
          })
        }
        return marker
      },
      onEachFeature: (feature, layer) => {
        if ('bindPopup' in layer) {
          layer.bindPopup(buildSaihPopupContent(feature), {
            closeButton: false,
            autoClose: false,
            closeOnClick: false,
            className: 'feature-hover-popup',
            offset: L.point(0, -14),
          })

          if (layer instanceof L.Marker) {
            layer.on({
              click: (e: L.LeafletMouseEvent) => {
                L.DomEvent.stopPropagation(e)
                const featureCode = String(
                  (feature.properties as Record<string, unknown>)?.stationCode ?? ''
                )
                const willSelect = props.selectedStationCode !== featureCode
                emit('update:selectedStationCode', willSelect ? featureCode : null)
              },
              mouseover: () => layer.openPopup(),
              mouseout: () => layer.closePopup(),
            })
          }
        }
      },
    })

    stationsLayer.addTo(map.value)
  }

  async function renderSelectedPolygon() {
    if (!map.value) return

    const configSPolygon = dynamicLayersConfig.find(
      (conf) => conf.id === props.type
    ) as WFSLayerConfig

    if (!configSPolygon) return

    const routeQueryKey =
      props.type === 'subcuencas'
        ? 'subcuenca'
        : props.type === 'sistemas10'
          ? 'sistema'
          : props.type === 'zonasexpl'
            ? 'zona'
            : 'comarca'

    const fieldName =
      props.type === 'subcuencas'
        ? 'code'
        : props.type === 'sistemas10'
          ? 'sistema'
          : props.type === 'zonasexpl'
            ? 'ogc_fid'
            : props.type === 'comarcasagrarias'
              ? 'ds_comarca'
              : 'code'

    const featurePolygon = await getWFSFeatureById(
      configSPolygon,
      fieldName,
      String(route.query[routeQueryKey])
    )

    if (!featurePolygon) return

    let styleOptions: L.PathOptions | undefined
    if (props.type === 'subcuencas') styleOptions = subcuencasStyle.normal
    else if (props.type === 'sistemas10') styleOptions = sistemas10Style.normal
    else if (props.type === 'zonasexpl') styleOptions = zonasexplStyle.normal
    else if (props.type === 'comarcasagrarias') styleOptions = comarcasagrariasStyle.normal

    if (polygonLayer) {
      map.value.removeLayer(polygonLayer)
      polygonLayer = null
    }

    polygonLayer = L.geoJSON(featurePolygon, {
      style: styleOptions,
    })

    map.value.fitBounds(polygonLayer.getBounds())
    polygonLayer.addTo(map.value)
  }

  onMounted(async () => {
    if (!mapContainerDetail.value) return

    map.value = L.map(mapContainerDetail.value, {
      zoomControl: true,
      minZoom,
    }).setView(center, defaultZoom)

    createMapPanes(map.value)

    const basemap = basemapsLayers.find((b) => b.id === selectedBasemap.value[0])

    if (basemap) {
      L.tileLayer(basemap.url, {
        attribution: basemap.attribution,
      }).addTo(map.value)
    }

    await renderSelectedPolygon()
    renderStationsLayer()

    map.value.on('click', () => {
      if (props.selectedStationCode) {
        emit('update:selectedStationCode', null)
      }
    })

    // Resize map
    const resizeObserver = new ResizeObserver(() => map.value?.invalidateSize())
    resizeObserver.observe(mapContainerDetail.value)

    onBeforeUnmount(() => {
      resizeObserver.disconnect()
      clearStationsLayer()
      if (polygonLayer && map.value) {
        map.value.removeLayer(polygonLayer)
        polygonLayer = null
      }
      map.value?.remove()
      map.value = null
    })
  })

  watch(
    [() => props.stations, () => props.selectedStationCode],
    ([, newCode]) => {
      renderStationsLayer()

      if (newCode && map.value) {
        const station = (props.stations ?? []).find((s) => s.stationCode === newCode)
        if (
          station &&
          station.latitude != null &&
          station.longitude != null &&
          Number.isFinite(station.latitude) &&
          Number.isFinite(station.longitude)
        ) {
          map.value.flyTo([station.latitude, station.longitude], 13, {
            animate: true,
            duration: 0.8,
          })
        }
      }
    },
    { deep: false }
  )
</script>

<style lang="scss" scoped>
  .map-container {
    height: 480px;
    width: 100%;
  }

  .map-container :deep(.saih-marker--selected) {
    outline: 3px solid rgba(68, 231, 141, 0.342);
    box-shadow: 0 0 0 4px currentColor;
    z-index: 9999 !important;
    transform: scale(1.18);
  }
</style>
