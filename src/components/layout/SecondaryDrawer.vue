<template>
  <v-navigation-drawer v-model="drawerOpen" permanent width="320" :mobile="true" color="background">
    <component :is="activeComponent" v-if="drawerOpen" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useNavigation } from '@/composables/useNavigation'

  import ItemsLayersPanel from '@/components/panels/ItemsLayersPanel.vue'
  import AlertsPanel from '@/components/panels/AlertsPanel.vue'
  import SettingsPanel from '@/components/panels/SettingsPanel.vue'
  import ReportsPanel from '../panels/ReportsPanel.vue'
  import BasemapsPanel from '../panels/BasemapsPanel.vue'
  import SimulationsPanel from '../panels/SimulationsPanel.vue'

  const { drawerOpen, activeSection } = useNavigation()

  const activeComponent = computed(() => {
    switch (activeSection.value) {
      case 'capas':
        return ItemsLayersPanel
      case 'avisos':
        return AlertsPanel
      case 'simulaciones':
        return SimulationsPanel
      case 'informes':
        return ReportsPanel
      case 'mapasbase':
        return BasemapsPanel
      case 'ajustes':
        return SettingsPanel
      default:
        return null
    }
  })
</script>

<style lang="scss" scoped></style>
