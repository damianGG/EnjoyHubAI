const MAPLIBRE_VERSION = "6.10.0"
const MAPLIBRE_CSS_ID = "enjoyhub-maplibre-css"
const MAPLIBRE_MODULE_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`

let mapLibrePromise: Promise<any> | null = null

export function getMapTilerKey() {
  return process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() ?? ""
}

export function getMapTilerStyleUrl(apiKey: string) {
  return `https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(apiKey)}`
}

export function loadMapLibre() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MapLibre can only be loaded in the browser."))
  }

  if (mapLibrePromise) return mapLibrePromise

  if (!document.getElementById(MAPLIBRE_CSS_ID)) {
    const css = document.createElement("link")
    css.id = MAPLIBRE_CSS_ID
    css.rel = "stylesheet"
    css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`
    document.head.appendChild(css)
  }

  mapLibrePromise = import(/* webpackIgnore: true */ MAPLIBRE_MODULE_URL)
    .then((module) => module)
    .catch((error) => {
      mapLibrePromise = null
      throw error
    })

  return mapLibrePromise
}
