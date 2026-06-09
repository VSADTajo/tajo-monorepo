<template>
  <v-row dense class="gap-2">
    <v-col cols="6" sm="3">
      <div class="pa-3 rounded bg-info-light" style="background: rgba(99, 125, 234, 0.08)">
        <div class="text-caption font-weight-bold text-primary mb-1">
          <v-icon size="small" class="me-1">mdi-map</v-icon>
          Zona
        </div>
        <div class="text-body-2 font-weight-medium">
          {{ props.feature.properties?.zona }}
        </div>
      </div>
    </v-col>

    <v-col cols="6" sm="3">
      <div class="pa-3 rounded" style="background: rgba(255, 152, 0, 0.08)">
        <div class="text-caption font-weight-bold mb-1" style="color: #ff9800">
          <v-icon size="small" class="me-1">mdi-city</v-icon>
          Municipio
        </div>
        <div class="text-body-2 font-weight-medium">
          {{ feature?.properties?.municipio }}
        </div>
      </div>
    </v-col>

    <v-col cols="6" sm="3">
      <div class="pa-3 rounded" style="background: rgba(76, 175, 80, 0.08)">
        <div class="text-caption font-weight-bold mb-1" style="color: #4caf50">
          <v-icon size="small" class="me-1">mdi-flag</v-icon>
          Provincia
        </div>
        <div class="text-body-2 font-weight-medium">
          {{ props.feature?.properties?.provincia }}
        </div>
      </div>
    </v-col>

    <v-col cols="6" sm="3">
      <div class="pa-3 rounded" style="background: rgba(233, 30, 99, 0.08)">
        <div class="text-caption font-weight-bold mb-1" style="color: #e91e63">
          <v-icon size="small" class="me-1">mdi-crown</v-icon>
          CCAA
        </div>
        <div class="text-body-2 font-weight-medium">
          {{ props.feature?.properties?.ccaa }}
        </div>
      </div>
    </v-col>
  </v-row>
</template>

<script lang="ts" setup>
  const props = defineProps<{
    feature: GeoJSON.Feature
  }>()
</script>
