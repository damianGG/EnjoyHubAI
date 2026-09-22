const MAPLIBRE_VERSION = "6.10.0"
const MAPLIBRE_SCRIPT_ID = "enjoyhub-maplibre-script"
const MAPLIBRE_CSS_ID = "enjoyhub-maplibre-css"

type MapLibreWindow = Window & {
  maplibregl?: any
}

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

  const browserWindow = window as MapLibreWindow
  if (browserWindow.maplibregl) return Promise.resolve(browserWindow.maplibregl)
  if (mapLibrePromise) return mapLibrePromise

  const existingCss = document.getElementById(MAPLIBRE_CSS_ID)
  if (!existingCss) {
    const css = document.createElement("link")
    css.id = MAPLIBRE_CSS_ID
    css.rel = "stylesheet"
    css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`
    document.head.appendChild(css)
  }

  mapLibrePromise = new Promise((resolve, reject) => {
    const resolveLibrary = () => {
      const library = (window as MapLibreWindow).maplibregl
      if (!library) {
        mapLibrePromise = null
        reject(new Error("MapLibre loaded without exposing maplibregl."))
        return
      }
      resolve(library)
    }

    const rejectLibrary = () => {
      mapLibrePromise = null
      reject(new Error("Unable to load MapLibre GL JS."))
    }

    const existingScript = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      if ((window as MapLibreWindow).maplibregl) {
        resolveLibrary()
        return
      }
      existingScript.addEventListener("load", resolveLibrary, { once: true })
      existingScript.addEventListener("error", rejectLibrary, { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = MAPLIBRE_SCRIPT_ID
    script.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`
    script.async = true
    script.addEventListener("load", resolveLibrary, { once: true })
    script.addEventListener("error", rejectLibrary, { once: true })
    document.head.appendChild(script)
  })

  return mapLibrePromise
}
