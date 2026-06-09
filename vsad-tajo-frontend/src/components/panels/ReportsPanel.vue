<template>
  <div class="h-100 d-flex flex-column">
    <v-row class="flex-grow-1">
      <v-col cols="12" class="d-flex align-center justify-space-between">
        <h2 class="pl-4 pt-4">Informes</h2>

        <v-btn icon class="mr-4 mt-4" color="primary" density="comfortable" @click="goBack">
          <v-icon>{{ mdAndUp ? 'mdi-arrow-left' : 'mdi-arrow-down' }}</v-icon>
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts" setup>
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'

  const { mdAndUp } = useDisplay()

  const router = useRouter()

  const goBack = () => {
    router.push('/')
  }
</script>
