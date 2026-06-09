<template>
  <!-- BOTÓN MOBILE -->
  <v-menu
    v-model="mobileMenuOpen"
    location="bottom"
    origin="bottom center"
    transition="dialog-bottom-transition"
    :close-on-content-click="true"
  >
    <template #activator="{ props }">
      <v-btn v-bind="props" icon="mdi-menu" size="small" variant="text" />
    </template>

    <v-sheet color="primary" class="mobile-menu-sheet" elevation="4">
      <v-list :selected="activeSection ? [activeSection] : []" bg-color="primary" nav>
        <v-list-item value="capas" @click="toggleSection('capas')">
          <v-list-item-title>Capas</v-list-item-title>
        </v-list-item>

        <v-list-item value="avisos" @click="toggleSection('avisos')">
          <v-list-item-title>Avisos</v-list-item-title>
        </v-list-item>

        <v-list-item value="simulaciones" @click="toggleSection('simulaciones')">
          <v-list-item-title>Simulaciones</v-list-item-title>
        </v-list-item>

        <v-list-item value="informes" @click="toggleSection('informes')">
          <v-list-item-title>Informes</v-list-item-title>
        </v-list-item>

        <v-list-item value="mapasbase" @click="toggleSection('mapasbase')">
          <v-list-item-title>Mapas Base</v-list-item-title>
        </v-list-item>

        <v-list-item value="ajustes" @click="toggleSection('ajustes')">
          <v-list-item-title>Ajustes</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-sheet>
  </v-menu>
</template>

<script setup lang="ts">
  import { ref } from 'vue'

  import { useNavigation } from '@/composables/useNavigation'

  const { toggleSection, activeSection } = useNavigation()

  const mobileMenuOpen = ref(false)
</script>

<style lang="scss" scoped>
  .mobile-menu-sheet {
    width: 100vw;
    margin-left: calc(-1 * var(--v-layout-left, 0px));
  }

  :deep(.v-overlay__content) {
    left: 0 !important;
  }
</style>
