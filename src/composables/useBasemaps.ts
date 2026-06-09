import { ref } from 'vue'

const selectedBasemap = ref<string[]>(['ign-es'])

export function useBasemap() {
  function setBasemap(id: string) {
    selectedBasemap.value = [id]
  }

  return {
    selectedBasemap,
    setBasemap,
  }
}
