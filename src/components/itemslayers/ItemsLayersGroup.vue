<template>
  <v-card elevation="1" class="layers-card" color="primary">
    <v-card-title
      class="layers-title d-flex justify-space-between align-center cursor-pointer"
      @click="isOpen = !isOpen"
    >
      <span>{{ title }}</span>

      <v-icon>
        {{ isOpen ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
      </v-icon>
    </v-card-title>

    <v-expand-transition>
      <div v-show="isOpen">
        <v-list
          v-model:selected="selectedLayers"
          active-strategy="independent"
          :select-strategy="componentProps.multiple ? 'independent' : 'single-independent'"
          :mandatory="false"
          bg-color="surface_variant"
          density="compact"
        >
          <template v-for="group in layers" :key="group.id">
            <!-- Si tiene hijos -->
            <v-list-group v-if="group.children" :value="group.id">
              <template #activator="{ props }">
                <v-list-item
                  v-bind="props"
                  class="d-flex justify-space-between align-center border"
                >
                  <!-- Título -->
                  <v-list-item-title class="d-flex align-center">
                    <v-checkbox
                      v-if="componentProps.multiple"
                      density="compact"
                      hide-details
                      class="mr-6"
                      color="success"
                      :model-value="isGroupChecked(group)"
                      :indeterminate="isGroupIndeterminate(group)"
                      @click.stop="toggleGroup(group)"
                    />
                    <span>{{ group.title }}</span>
                  </v-list-item-title>
                </v-list-item>
              </template>

              <template v-for="child in group.children" :key="child.id">
                <!-- Subgrupo -->
                <v-list-group v-if="child.children" :value="child.id">
                  <template #activator="{ props }">
                    <v-list-item
                      v-bind="props"
                      :title="child.title"
                      class="border"
                      @click.stop="toggleGroup(child)"
                    />
                  </template>

                  <v-list-item
                    v-for="sub in child.children"
                    :key="sub.id"
                    :value="sub.id"
                    class="border"
                    selectable
                    :title="sub.title"
                  />
                </v-list-group>

                <!-- Hoja -->
                <v-list-item
                  v-else
                  :value="child.id"
                  :title="child.title"
                  class="border"
                  selectable
                />

                <v-expand-transition>
                  <div
                    v-if="child.opacityEnabled && selectedLayers.includes(child.id)"
                    class="px-6 pb-2"
                  >
                    <v-slider
                      v-model="store.layers[child.id].opacity"
                      min="0"
                      max="1"
                      step="0.05"
                      density="compact"
                      hide-details
                      @update:model-value="store.setOpacity(child.id, $event)"
                    />
                  </div>
                </v-expand-transition>
              </template>
            </v-list-group>

            <!-- Si NO tiene hijos -->
            <v-list-item v-else :value="group.id" :title="group.title" class="border" />

            <v-expand-transition>
              <div
                v-if="group.opacityEnabled && selectedLayers.includes(group.id)"
                class="px-6 pb-2"
              >
                <v-slider
                  v-model="store.layers[group.id].opacity"
                  min="0"
                  max="1"
                  step="0.05"
                  density="compact"
                  hide-details
                  @update:model-value="store.setOpacity(group.id, $event)"
                />
              </div>
            </v-expand-transition>
          </template>
        </v-list>
      </div>
    </v-expand-transition>
  </v-card>
</template>

<script setup lang="ts">
  import type { LayerNode } from '@/types/Layers'
  import { ref } from 'vue'
  import { computed } from 'vue'
  import { useLayersStore } from '@/stores/layersStore'
  import { useAvisosStore } from '@/stores/avisosStore'
  import { zonasLayers, meteoMaps, efasLayers } from '@/constants/itemsLayers'

  const componentProps = defineProps<{
    layers: LayerNode[]
    title: string
    multiple: boolean
    defaultOpen?: boolean
  }>()

  const store = useLayersStore()
  const avisosStore = useAvisosStore()

  const isOpen = ref(componentProps.defaultOpen ?? true)

  const groupLeafNodes = computed(() => getAllLeafNodes(componentProps.layers))
  const isAvisosGroup = computed(
    () =>
      groupLeafNodes.value.length > 0 &&
      groupLeafNodes.value.every((node) => node.parentLayer === 'avisos_aemet')
  )
  const exclusiveSingleGroupLeafIds = getAllLeafIds([...zonasLayers, ...meteoMaps, ...efasLayers])

  const selectedLayers = computed<string[]>({
    get: () => {
      if (isAvisosGroup.value) {
        return avisosStore.selectedTipo ? [avisosStore.selectedTipo] : []
      }

      return groupLeafNodes.value
        .filter(
          (node) =>
            isMatchingLayerState(node.id, node.parentLayer) && store.layers[node.id]?.visible
        )
        .map((node) => node.id)
    },

    set: (newIds: string[]) => {
      // En grupos de selección única, aplicar exclusividad también entre grupos simples
      if (!componentProps.multiple) {
        if (isAvisosGroup.value) {
          const selectedAvisoTipo = newIds[0]

          // Toggle explícito: segundo click sobre el mismo item deselecciona
          if (selectedAvisoTipo && selectedAvisoTipo !== avisosStore.selectedTipo) {
            // Si se activa un aviso, apagar cualquier capa visible de Zonas/Meteo/EFAS
            exclusiveSingleGroupLeafIds.forEach((id) => {
              if (store.layers[id]?.visible) {
                store.setLayerVisibility(id, false)
              }
            })

            void avisosStore.selectAviso(selectedAvisoTipo)
          } else {
            avisosStore.clearSelectedAviso()
          }

          return
        }

        exclusiveSingleGroupLeafIds.forEach((id) => {
          const shouldBeVisible = newIds.includes(id)
          const isVisible = store.layers[id]?.visible

          if (shouldBeVisible !== isVisible) {
            store.setLayerVisibility(id, shouldBeVisible)
          }
        })

        // Si se activa una capa de Zonas/Meteo/EFAS, desactivar selección de avisos
        if (newIds.length > 0 && avisosStore.selectedTipo) {
          avisosStore.clearSelectedAviso()
        }

        return
      }

      // Solo afectar a los ids de ESTE grupo
      groupLeafNodes.value.forEach((node) => {
        if (!isMatchingLayerState(node.id, node.parentLayer)) return

        const shouldBeVisible = newIds.includes(node.id)
        const isVisible = store.layers[node.id]?.visible

        if (shouldBeVisible !== isVisible) {
          store.setLayerVisibility(node.id, shouldBeVisible)
        }
      })
    },
  })

  function isMatchingLayerState(id: string, parentLayer?: string): boolean {
    const layerState = store.layers[id]
    if (!layerState) return false
    if (!parentLayer) return true
    return layerState.parentLayer === parentLayer
  }

  function getLeafIds(node: LayerNode): string[] {
    if (!node.children) return [node.id]

    return node.children.flatMap(getLeafIds)
  }

  function toggleGroup(group: LayerNode) {
    const leafIds = getLeafIds(group)

    const allSelected = leafIds.every((id) => selectedLayers.value.includes(id))

    if (allSelected) {
      // Quitar todos
      selectedLayers.value = selectedLayers.value.filter((id) => !leafIds.includes(id))
    } else {
      // Añadir los que falten
      selectedLayers.value = [...new Set([...selectedLayers.value, ...leafIds])]
    }
  }

  function isGroupChecked(group: LayerNode) {
    const leafIds = getLeafIds(group)
    return leafIds.every((id) => selectedLayers.value.includes(id))
  }

  function isGroupIndeterminate(group: LayerNode) {
    const leafIds = getLeafIds(group)

    const selectedCount = leafIds.filter((id) => selectedLayers.value.includes(id)).length

    return selectedCount > 0 && selectedCount < leafIds.length
  }

  function getAllLeafIds(nodes: LayerNode[]): string[] {
    return nodes.flatMap((node) => (node.children ? getAllLeafIds(node.children) : node.id))
  }

  function getAllLeafNodes(nodes: LayerNode[]): LayerNode[] {
    return nodes.flatMap((node) => (node.children ? getAllLeafNodes(node.children) : node))
  }
</script>

<style scoped></style>
