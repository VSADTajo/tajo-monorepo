<template>
  <div class="d-flex flex-column">
    <v-row class="flex-grow-1">
      <v-col cols="12" class="d-flex align-center justify-space-between">
        <h2 class="pl-4 pt-4">Mapas Base</h2>

        <v-btn icon class="mr-4 mt-4" color="primary" density="comfortable" @click="goBack">
          <v-icon>{{ mdAndUp ? 'mdi-arrow-left' : 'mdi-arrow-down' }}</v-icon>
        </v-btn>
      </v-col>
    </v-row>
    <v-row class="flex-grow-1">
      <v-col cols="12" class="px-4">
        <v-list
          v-model:selected="selectedBasemap"
          class="flex-grow-1 pa-0 border"
          bg-color="surface_variant"
        >
          <v-list-item
            v-for="layer in basemapsLayers"
            :key="layer.id"
            :value="layer.id"
            class="rounded pa-3 elevation-2"
            :class="{
              'basemap-active': selectedBasemap.includes(layer.id),
            }"
            @click="setBasemap(layer.id)"
          >
            <div class="d-flex align-center justify-space-between w-100">
              <!-- Nombre -->
              <div class="text-subtitle-1 font-weight-medium">
                {{ layer.name }}
              </div>

              <!-- Preview -->
              <v-avatar size="64" rounded="lg" class="elevation-2">
                <img :src="layer.preview" alt="preview" />
              </v-avatar>
            </div>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts" setup>
  import { basemapsLayers } from '@/constants/basemaps'

  import { useBasemap } from '@/composables/useBasemaps'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'

  const { selectedBasemap, setBasemap } = useBasemap()
  const { mdAndUp } = useDisplay()

  const router = useRouter()

  const goBack = () => {
    router.push('/')
  }
</script>

<style lang="scss" scoped>
  .basemap-active {
    background-color: rgb(var(--v-theme-primary));
    color: white;
    --v-theme-primary-overlay-multiplier: 0;
  }
</style>
