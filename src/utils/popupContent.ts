/**
 * Construye HTML para popups de features de la aplicación
 */

export function buildSubcuencaPopupContent(feature: GeoJSON.Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>

  const code = escapeHtml(String(props.code ?? 'N/A'))
  const nombre = escapeHtml(String(props.name ?? 'Sin nombre'))

  return `
    <div style="min-width:200px;border-radius:8px;overflow:hidden;font-family:Montserrat,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.12)">
      <div style="padding:10px 12px;background:#8d5d26;color:#fff">
        <div style="font-size:14px;font-weight:700;line-height:1.2">${code}</div>
        <div style="font-size:11px;opacity:.9;margin-top:2px;line-height:1.2">${nombre}</div>
      </div>
    </div>
  `
}

export function buildSistemaPopupContent(feature: GeoJSON.Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>

  const sistema = escapeHtml(String(props.sistema ?? 'N/A'))
  const id = escapeHtml(String(props.fid ?? 'Sin nombre'))

  return `
    <div style="min-width:200px;border-radius:8px;overflow:hidden;font-family:Montserrat,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.12)">
      <div style="padding:10px 12px;background:#33a02c;color:#fff">
        <div style="font-size:14px;font-weight:700;line-height:1.2">${id}</div>
        <div style="font-size:11px;opacity:.9;margin-top:2px;line-height:1.2">${sistema}</div>
      </div>
    </div>
  `
}

export function buildZonaPopupContent(feature: GeoJSON.Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>

  const nombre = escapeHtml(String(props.nombre ?? 'Sin nombre'))

  return `
    <div style="min-width:200px;border-radius:8px;overflow:hidden;font-family:Montserrat,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.12)">
      <div style="padding:10px 12px;background:#1f78b4;color:#fff">
        <div style="font-size:14px;font-weight:700;line-height:1.2">${nombre}</div>
      </div>
    </div>
  `
}

export function buildComarcaPopupContent(feature: GeoJSON.Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>

  const nombre = escapeHtml(String(props.ds_comarca ?? 'Sin nombre'))

  return `
    <div style="min-width:200px;border-radius:8px;overflow:hidden;font-family:Montserrat,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.12)">
      <div style="padding:10px 12px;background:#aa3c3c;color:#fff">
        <div style="font-size:14px;font-weight:700;line-height:1.2">${nombre}</div>
      </div>
    </div>
  `
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
