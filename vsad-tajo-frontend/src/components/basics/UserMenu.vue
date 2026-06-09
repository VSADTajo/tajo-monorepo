<template>
  <v-menu location="bottom end" transition="scale-transition" :close-on-content-click="false">
    <template #activator="{ props }">
      <v-btn v-bind="props" icon variant="text">
        <v-avatar size="38" color="white">
          <v-icon color="primary">mdi-account-circle</v-icon>
        </v-avatar>
      </v-btn>
    </template>

    <v-card min-width="300" rounded="xl" elevation="8">
      <div class="pa-4 bg-primary text-white">
        <div class="d-flex align-center">
          <v-avatar size="48" color="white" class="mr-3">
            <v-icon color="primary" size="32">mdi-account</v-icon>
          </v-avatar>

          <div class="overflow-hidden">
            <div class="text-subtitle-1 font-weight-bold">Bienvenido</div>
            <div class="text-body-2 text-truncate">{{ userEmail }}</div>
          </div>
        </div>
      </div>

      <v-list density="comfortable" class="py-2">
        <v-list-item>
          <template #prepend>
            <v-icon>
              {{ isDark ? 'mdi-weather-night' : 'mdi-weather-sunny' }}
            </v-icon>
          </template>

          <v-list-item-title>Tema oscuro</v-list-item-title>

          <template #append>
            <v-switch v-model="isDark" inset hide-details color="primary" />
          </template>
        </v-list-item>

        <v-divider class="my-2" />

        <v-list-item prepend-icon="mdi-email-outline">
          <v-list-item-title>Correo</v-list-item-title>
          <v-list-item-subtitle>{{ userEmail }}</v-list-item-subtitle>
        </v-list-item>

        <v-divider class="my-2" />

        <v-list-item
          prepend-icon="mdi-logout"
          title="Cerrar sesión"
          class="text-error"
          @click="logout"
        />
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStorage } from '@vueuse/core'
  import type { Theme } from '@/types/config'

  const router = useRouter()

  const userEmail = useStorage('email', 'usuario@correo.com')
  const theme = useStorage<Theme>('theme', 'light')

  const isDark = computed({
    get: () => theme.value === 'dark',
    set: (val: boolean) => {
      theme.value = val ? 'dark' : 'light'
    },
  })

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    router.push({ name: 'login' })
  }
</script>

<style scoped>
  .overflow-hidden {
    overflow: hidden;
  }
</style>
