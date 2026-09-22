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

function includesAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token))
}

function shouldHideDetailLayer(layerId: string) {
  return includesAny(layerId, [
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
    "pedestrian",
    "cycleway",
    "footway",
  ])
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

/**
 * Keeps the MapTiler vector data, but gives EnjoyHub one quiet, familiar map
 * treatment: pale green nature areas, cool blue water, neutral city fabric,
 * white local roads and restrained Polish labels. The theme argument remains
 * for the location picker API, but both public map modes intentionally share
 * the same visual language now.
 */
export function applyEnjoyHubMapTheme(map: any, _theme: EnjoyHubMapTheme = "enjoyhub") {
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

      const isRoadLabel = includesAny(normalizedId, ["road", "street", "highway", "motorway"])
      const isWaterLabel = includesAny(normalizedId, ["water", "marine"])
      const isPlaceLabel = includesAny(normalizedId, ["place", "city", "town", "village", "settlement"])

      setPaintSafely(
        map,
        id,
        "text-color",
        isRoadLabel ? "#777773" : isWaterLabel ? "#6d98a7" : isPlaceLabel ? "#686864" : "#73736f",
      )
      setPaintSafely(map, id, "text-halo-color", "#f7f6f1")
      setPaintSafely(map, id, "text-halo-width", 1.35)
      setPaintSafely(map, id, "text-halo-blur", 0.25)
      continue
    }

    if (layer.type === "background") {
      setPaintSafely(map, id, "background-color", "#f3f2ed")
      continue
    }

    if (layer.type === "fill") {
      if (normalizedId.includes("water")) {
        setPaintSafely(map, id, "fill-color", "#b9deea")
        setPaintSafely(map, id, "fill-opacity", 1)
      } else if (normalizedId.includes("building")) {
        setLayoutSafely(map, id, "visibility", "none")
      } else if (
        includesAny(normalizedId, [
          "park",
          "grass",
          "wood",
          "forest",
          "nature",
          "natural",
          "green",
          "landcover",
        ])
      ) {
        setPaintSafely(map, id, "fill-color", "#dcefc1")
        setPaintSafely(map, id, "fill-opacity", 0.92)
      } else if (
        includesAny(normalizedId, [
          "residential",
          "urban",
          "commercial",
          "industrial",
          "landuse",
        ])
      ) {
        setPaintSafely(map, id, "fill-color", "#efeee9")
        setPaintSafely(map, id, "fill-opacity", 0.9)
      }
      continue
    }

    if (layer.type === "line") {
      if (shouldHideDetailLayer(normalizedId)) {
        setLayoutSafely(map, id, "visibility", "none")
        continue
      }

      if (includesAny(normalizedId, ["waterway", "river", "stream", "canal"])) {
        setPaintSafely(map, id, "line-color", "#b4d9e5")
        continue
      }

      if (includesAny(normalizedId, ["road", "street", "highway", "motorway", "trunk", "primary", "secondary"])) {
        const isCasing = includesAny(normalizedId, ["casing", "outline"])
        const isMajor = includesAny(normalizedId, ["motorway", "trunk", "primary"])
        setPaintSafely(map, id, "line-color", isCasing ? "#d6d5d0" : isMajor ? "#deddd9" : "#ffffff")
        setPaintSafely(map, id, "line-opacity", 0.96)
        continue
      }

      if (normalizedId.includes("boundary")) {
        setPaintSafely(map, id, "line-color", "#c8c8c3")
        setPaintSafely(map, id, "line-opacity", 0.7)
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
