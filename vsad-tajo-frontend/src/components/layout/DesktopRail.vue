<template>
  <v-navigation-drawer permanent rail width="72" color="primary" class="d-flex flex-column">
    <!-- PARTE SUPERIOR -->
    <v-row class="h-100" no-gutters>
      <v-list nav class="d-flex flex-column flex-grow-1">
        <v-list-item
          prepend-icon="mdi-layers"
          :active="activeSection === 'capas'"
          @click="toggleSection('capas')"
        />

        <v-list-item
          prepend-icon="mdi-alert-outline"
          :active="activeSection === 'avisos'"
          @click="toggleSection('avisos')"
        />

        <v-list-item
          prepend-icon="mdi-tune-variant"
          :active="activeSection === 'simulaciones'"
          @click="toggleSection('simulaciones')"
        />

        <v-list-item
          prepend-icon="mdi-file-chart-outline"
          :active="activeSection === 'informes'"
          @click="toggleSection('informes')"
        />
      </v-list>

      <!-- PARTE INFERIOR -->
      <v-list nav class="d-flex flex-column flex-grow-0 justify-end">
        <v-list-item
          prepend-icon="mdi-map"
          :active="activeSection === 'mapasbase'"
          @click="toggleSection('mapasbase')"
        />

        <v-list-item
          prepend-icon="mdi-cog-outline"
          :active="activeSection === 'ajustes'"
          @click="toggleSection('ajustes')"
        />
      </v-list>
    </v-row>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
  import { useNavigation } from '@/composables/useNavigation'

  const { activeSection, toggleSection } = useNavigation()
</script>
