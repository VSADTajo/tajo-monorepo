import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useReportingPointStore = defineStore('reportingPoint', () => {
  const stationId = ref<string | null>(null)
  const html = ref<string>('')

  function setReportingPoint(data: { stationId: string; html: string }) {
    stationId.value = data.stationId
    html.value = data.html
  }

  function clearReportingPoint() {
    stationId.value = null
    html.value = ''
  }

  return {
    stationId,
    html,
    setReportingPoint,
    clearReportingPoint,
  }
})
