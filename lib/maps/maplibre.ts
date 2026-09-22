const MAPLIBRE_VERSION = "6.10.0"
const MAPLIBRE_CSS_ID = "enjoyhub-maplibre-css"
const MAPLIBRE_MODULE_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`
const MAPTILER_BASE_STYLE = "base-v4"

export type EnjoyHubMapTheme = "simple" | "enjoyhub"

let mapLibrePromise: Promise<any> | null = null

export function getMapTilerKey() {
  return process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() ?? ""
}

export function getMapTilerStyleUrl(apiKey: string) {
  return `https://api.maptiler.com/maps/${MAPTILER_BASE_STYLE}/style.json?key=${encodeURIComponent(apiKey)}`
}

function localizeTextField(value: any): any {
  if (Array.isArray(value)) {
    if (
      value[0] === "get" &&
      typeof value[1] === "string" &&
      ["name", "name:latin", "name:en"].includes(value[1])
    ) {
      return ["coalesce", ["get", "name:pl"], value]
    }
    return value.map(localizeTextField)
  }

  if (typeof value === "string") {
    return value
      .replaceAll("{name:latin}", "{name:pl}")
      .replaceAll("{name:en}", "{name:pl}")
  }

  return value
}

function shouldHideDetailLayer(layerId: string) {
  return [
    "poi",
    "housenumber",
    "house_number",
    "building",
    "indoor",
    "transit",
    "rail",
    "ferry",
    "parking",
    "amenity",
    "shop",
    "aeroway",
    "airport",
  ].some((token) => layerId.includes(token))
}

function setLayoutSafely(map: any, layerId: string, property: string, value: any) {
  try {
    map.setLayoutProperty(layerId, property, value)
  } catch {
    // Styles differ slightly between MapTiler releases; unsupported properties are skipped.
  }
}

function setPaintSafely(map: any, layerId: string, property: string, value: any) {
  try {
    map.setPaintProperty(layerId, property, value)
  } catch {
    // Styles differ slightly between MapTiler releases; unsupported properties are skipped.
  }
}

export function applyEnjoyHubMapTheme(map: any, theme: EnjoyHubMapTheme) {
  const layers = map.getStyle()?.layers ?? []

  for (const layer of layers) {
    const id = String(layer.id)
    const normalizedId = id.toLowerCase()

    if (layer.type === "symbol") {
      const textField = map.getLayoutProperty(id, "text-field")
      if (textField) setLayoutSafely(map, id, "text-field", localizeTextField(textField))

      if (shouldHideDetailLayer(normalizedId)) {
        setLayoutSafely(map, id, "visibility", "none")
        continue
      }

      if (theme === "enjoyhub") {
        setPaintSafely(map, id, "text-color", "#505967")
        setPaintSafely(map, id, "text-halo-color", "#fffaf7")
        setPaintSafely(map, id, "text-halo-width", 1.25)
      }
    }

    if (layer.type === "background" && theme === "enjoyhub") {
      setPaintSafely(map, id, "background-color", "#fffaf7")
      continue
    }

    if (layer.type === "fill") {
      if (normalizedId.includes("water")) {
        setPaintSafely(map, id, "fill-color", theme === "enjoyhub" ? "#dcecf7" : "#e5f1f8")
      } else if (
        theme === "enjoyhub" &&
        ["park", "grass", "wood", "forest", "landcover", "landuse"].some((token) => normalizedId.includes(token))
      ) {
        setPaintSafely(map, id, "fill-color", "#edf4e8")
      } else if (theme === "enjoyhub" && normalizedId.includes("building")) {
        setLayoutSafely(map, id, "visibility", "none")
      }
    }

    if (layer.type === "line") {
      if (
        theme === "enjoyhub" &&
        ["road", "street", "highway", "motorway", "path"].some((token) => normalizedId.includes(token))
      ) {
        setPaintSafely(map, id, "line-color", "#eaded8")
      } else if (theme === "enjoyhub" && normalizedId.includes("boundary")) {
        setPaintSafely(map, id, "line-color", "#d6d9df")
      }

      if (shouldHideDetailLayer(normalizedId)) {
        setLayoutSafely(map, id, "visibility", "none")
      }
    }
  }
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
