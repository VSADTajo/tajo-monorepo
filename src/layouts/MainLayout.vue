<template>
  <TopBar />

  <DesktopRail v-if="mdAndUp" />

  <SecondaryDrawer v-if="mdAndUp" />

  <MobileBottomDrawer v-if="!mdAndUp" />

  <RightNavigation />

  <v-main class="main-container">
    <router-view />
  </v-main>
</template>

<script setup lang="ts">
  import { useDisplay } from 'vuetify'
  import TopBar from '@/components/layout/TopBar.vue'
  import DesktopRail from '@/components/layout/DesktopRail.vue'
  import SecondaryDrawer from '@/components/layout/SecondaryDrawer.vue'
  import MobileBottomDrawer from '@/components/layout/mobile/MobileBottomDrawer.vue'
  import RightNavigation from '@/components/rightContainer/RightNavigation.vue'

  const { mdAndUp } = useDisplay()
</script>
