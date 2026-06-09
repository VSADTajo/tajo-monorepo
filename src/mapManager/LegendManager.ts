import L from 'leaflet'

type GradientLegendOptions = {
  title: string
  legendUrl: string
  units?: string
}

export class LegendManager {
  private map: L.Map
  private legends: Record<string, L.Control> = {}

  constructor(map: L.Map) {
    this.map = map
  }

  addLegend(layerId: string, url: string) {
    if (this.legends[layerId]) return

    const legend = new L.Control({ position: 'bottomright' })

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control custom-legend')

      const img = document.createElement('img')
      img.src = url

      div.appendChild(img)

      return div
    }

    legend.addTo(this.map)

    this.legends[layerId] = legend
  }

  async addGradientLegend(layerId: string, options: GradientLegendOptions) {
    if (this.legends[layerId]) return

    const legend = new L.Control({ position: 'bottomright' })

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-control custom-legend custom-legend-gradient')
      const unitsText = options.units ? ` (${options.units})` : ''
      const header = document.createElement('div')
      header.className = 'custom-legend-header'
      header.textContent = `${options.title}${unitsText}`

      const body = document.createElement('div')
      body.className = 'custom-legend-body is-loading'

      const loading = document.createElement('div')
      loading.className = 'custom-legend-loading'
      loading.innerHTML =
        '<span class="custom-legend-spinner" aria-hidden="true"></span><span>Cargando leyenda...</span>'

      const image = document.createElement('img')
      image.className = 'custom-legend-image'
      image.alt = `Leyenda ${options.title}`
      image.src = options.legendUrl

      image.addEventListener('load', () => {
        body.classList.remove('is-loading')
      })

      image.addEventListener('error', () => {
        loading.innerHTML = '<span>No se pudo cargar la leyenda</span>'
      })

      body.appendChild(loading)
      body.appendChild(image)
      div.appendChild(header)
      div.appendChild(body)

      return div
    }

    legend.addTo(this.map)
    this.legends[layerId] = legend
  }

  removeLegend(layerId: string) {
    const legend = this.legends[layerId]

    if (!legend) return

    legend.remove()

    delete this.legends[layerId]
  }
}
