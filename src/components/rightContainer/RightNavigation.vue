<template>
  <v-navigation-drawer
    :model-value="drawerOpen"
    class="bg-background"
    location="right"
    :width="drawerWidth"
    transition="slide-x-reverse-transition"
    :scrim="true"
    temporary
    @update:model-value="onDrawerChange"
  >
    <RightContentSaih v-if="station" />
    <RightContentReporting v-if="reporting" />
    <RightContentByAreaService v-if="subcuenca" kind="subcuenca" />
    <RightContentByAreaService v-if="sistema" kind="sistema" />
    <RightContentByAreaService v-if="zona" kind="zona" />
    <RightContentByAreaService v-if="comarca" kind="comarca" />
    <RightContentPrecipitacion v-if="precipitacion" />
    <RightContentAviso v-if="aviso" />
  </v-navigation-drawer>
</template>

<script lang="ts" setup>
  import { computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import RightContentSaih from './RightContentSaih.vue'
  import RightContentReporting from './RightContentReporting.vue'
  import RightContentByAreaService from './RightContentByAreaService.vue'
  import RightContentPrecipitacion from './RightContentPrecipitacion.vue'
  import RightContentAviso from './RightContentAviso.vue'

  const route = useRoute()
  const router = useRouter()
  const { mdAndUp, width } = useDisplay()

  const station = computed(() => route.query.station as string | undefined)

  const reporting = computed(() => route.query.reportingPoint as string | undefined)

  const subcuenca = computed(() => route.query.subcuenca as string | undefined)

  const sistema = computed(() => route.query.sistema as string | undefined)

  const zona = computed(() => route.query.zona as string | undefined)

  const comarca = computed(() => route.query.comarca as string | undefined)

  const precipitacion = computed(() => route.query.precipitacion as string | undefined)

  const aviso = computed(() => route.query.aviso as string | undefined)

  // drawer abierto si hay station
  const drawerOpen = computed(
    () =>
      !!station.value ||
      !!reporting.value ||
      !!subcuenca.value ||
      !!sistema.value ||
      !!zona.value ||
      !!comarca.value ||
      !!precipitacion.value ||
      !!aviso.value
  )

  // ignorar cierre inmediato por scrim
  let ignoreNextClose = false

  watch(station, (val, oldVal) => {
    if (val && !oldVal) {
      ignoreNextClose = true
      setTimeout(() => (ignoreNextClose = false), 150)
    }
  })

  watch(aviso, (val, oldVal) => {
    if (val && !oldVal) {
      ignoreNextClose = true
      setTimeout(() => (ignoreNextClose = false), 150)
    }
  })

  function onDrawerChange(val: boolean) {
    if (!val && !ignoreNextClose) {
      const queryObj = { ...route.query }
      delete queryObj.station
      delete queryObj.aviso
      router.replace({ query: queryObj })
    }
  }

  // ancho responsive
  const drawerWidth = computed(() => (mdAndUp.value ? width.value * 0.8 : width.value))
</script>
