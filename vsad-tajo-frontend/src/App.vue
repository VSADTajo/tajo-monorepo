<template>
  <v-app :theme="theme">
    <router-view />
  </v-app>
</template>

<script setup lang="ts">
  import { useStorage } from '@vueuse/core'
  import { type Theme } from './types/config'
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'

  const route = useRoute()

  const theme = useStorage<Theme>('theme', 'light')

  const isLogin = computed(() => {
    return route.name === 'login'
  })
</script>
