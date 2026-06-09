import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useNavigation() {
  const route = useRoute()
  const router = useRouter()

  const activeSection = computed(() => {
    if (route.path === '/') return null
    return route.path.replace('/', '')
  })

  const drawerOpen = computed(() => !!activeSection.value)

  function toggleSection(section: string) {
    if (activeSection.value === section) {
      router.push('/')
      return
    }

    router.push(`/${section}`)
  }

  return {
    drawerOpen,
    activeSection,
    toggleSection,
  }
}
