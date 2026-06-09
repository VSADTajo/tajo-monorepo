<template>
  <v-card class="bg-surface" elevation="2">
    <v-card-title class="text-subtitle-1 font-weight-bold">Resumen prediccion semana</v-card-title>
    <v-divider />
    <v-card-text>
      <v-row>
        <v-col cols="7" class="text-caption text-medium-emphasis">Caudal minimo previsto</v-col>
        <v-col cols="5" class="text-right font-weight-medium">
          {{ weeklyPredictionSummary.minFlowForecast }}
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="7" class="text-caption text-medium-emphasis">Caudal maximo previsto</v-col>
        <v-col cols="5" class="text-right font-weight-medium">
          {{ weeklyPredictionSummary.maxFlowForecast }}
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="7" class="text-caption text-medium-emphasis">Caudal medio previsto</v-col>
        <v-col cols="5" class="text-right font-weight-medium">
          {{ weeklyPredictionSummary.avgFlowForecast }}
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="7" class="text-caption text-medium-emphasis">Periodo</v-col>
        <v-col cols="5" class="text-right font-weight-medium">
          {{ weeklyPredictionSummary.period }}
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { ref } from 'vue'

  const weeklyPredictionSummary = ref({
    minFlowForecast: '35.4 m3/s',
    maxFlowForecast: '58.7 m3/s',
    avgFlowForecast: '44.9 m3/s',
    period: '16/04/2026 - 22/04/2026',
  })
</script>
