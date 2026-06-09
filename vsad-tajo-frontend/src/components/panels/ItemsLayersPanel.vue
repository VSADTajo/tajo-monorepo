<template>
  <div class="container">
    <!-- HEADER FIJO -->
    <div class="header">
      <v-row class="flex-grow-1">
        <v-col cols="12" class="d-flex align-center justify-space-between">
          <h2 class="pl-4 pt-4">Capas</h2>

          <v-btn icon class="mr-4 mt-4" color="primary" density="comfortable" @click="goBack">
            <v-icon>{{ mdAndUp ? 'mdi-arrow-left' : 'mdi-arrow-down' }}</v-icon>
          </v-btn>
        </v-col>
        <v-divider></v-divider>
      </v-row>
    </div>

    <!-- CONTENIDO CON SCROLL -->
    <div class="content mt-4">
      <v-row>
        <v-col cols="12" class="pb-1 px-4">
          <ItemsLayersGroup
            v-col
            :layers="stationLayers"
            title="Estaciones"
            :multiple="true"
            :default-open="true"
          />
        </v-col>
        <v-col cols="12" class="pt-1 pb-1 px-4">
          <ItemsLayersGroup
            :layers="zonasLayers"
            title="Zonas"
            :multiple="false"
            :default-open="false"
          />
        </v-col>
        <v-col cols="12" class="pt-1 pb-1 px-4">
          <ItemsLayersGroup
            :layers="meteoMaps"
            title="Mapas Meteo"
            :multiple="false"
            :default-open="false"
          />
        </v-col>
        <v-col cols="12" class="pt-1 pb-1 px-4">
          <ItemsLayersGroup
            :layers="efasLayers"
            title="Mapas Efas"
            :multiple="false"
            :default-open="false"
          />
        </v-col>

        <v-col cols="12" class="pt-1 px-4">
          <ItemsLayersGroup
            :layers="avisosLayers"
            title="Avisos"
            :multiple="false"
            :default-open="false"
          />
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { useRouter } from 'vue-router'
  import ItemsLayersGroup from '../itemslayers/ItemsLayersGroup.vue'

  import {
    stationLayers,
    zonasLayers,
    meteoMaps,
    efasLayers,
    avisosLayers,
  } from '@/constants/itemsLayers'
  import { useDisplay } from 'vuetify'

  const { mdAndUp } = useDisplay()

  const router = useRouter()

  const goBack = () => {
    router.push('/')
  }
</script>

<style lang="scss" scoped>
  .container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  // .header {
  //   flex-shrink: 0;
  // }

  .content {
    flex-grow: 0;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
  }
</style>
