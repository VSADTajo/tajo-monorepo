<template>
  <v-navigation-drawer
    v-model="drawerOpen"
    color="background"
    location="bottom"
    height="700px"
    temporary
    :scrim="false"
  >
    <component :is="activeComponent" v-if="activeComponent" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useNavigation } from '@/composables/useNavigation'

  import ItemsLayersPanel from '@/components/panels/ItemsLayersPanel.vue'
  import AlertsPanel from '@/components/panels/AlertsPanel.vue'
  import SettingsPanel from '@/components/panels/SettingsPanel.vue'
  import ReportsPanel from '@/components/panels/ReportsPanel.vue'
  import BasemapsPanel from '@/components/panels/BasemapsPanel.vue'
  import SimulationsPanel from '@/components/panels/SimulationsPanel.vue'

  const { activeSection, drawerOpen } = useNavigation()

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

<style></style>
