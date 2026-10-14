import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { loadGoogleMapsScript, getGoogleMapsApiKey } from "../../utils/googleMapsLoader";
import "./GoogleMap.css";

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }]
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334e87" }]
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#023e58" }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d6a" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f9ba5" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#304a7d" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2c6675" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#255463" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e1626" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4e6d70" }]
  }
];

export default function GoogleMap({
  center,
  zoom = 15,
  markers = [],
  route = null, // { origin: { lat, lng }, destination: { lat, lng } }
  height = "320px",
  statusText = null,
  onCenterClick = null,
  onRouteCalculated = null,
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const directionsRendererRef = useRef(null);

  // Leaflet fallback refs for real tile rendering when Google Maps key is omitted
  const leafletContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletMarkersRef = useRef({});
  const leafletPolylineRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const hasKey = !!getGoogleMapsApiKey();
  const validCenter = center && center.lat != null && center.lng != null && !isNaN(center.lat) && !isNaN(center.lng);
  const isRealBrowser = typeof window !== "undefined" && typeof document !== "undefined" && typeof window.navigator?.userAgent === "string" && !window.navigator.userAgent.includes("jsdom");

  // Google Maps JS API loader
  useEffect(() => {
    let isMounted = true;
    if (!hasKey) {
      setMapLoaded(false);
      return;
    }

    loadGoogleMapsScript()
      .then((maps) => {
        if (!isMounted || !containerRef.current) return;

        if (!mapInstanceRef.current) {
          const defaultCenter = validCenter ? center : { lat: 20.5937, lng: 78.9629 };
          const map = new maps.Map(containerRef.current, {
            center: defaultCenter,
            zoom,
            styles: DARK_MAP_STYLE,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          mapInstanceRef.current = map;
        }
        setMapLoaded(true);
        setLoadError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setMapLoaded(false);
        setLoadError(err.message || "Could not load Google Maps");
      });

    return () => {
      isMounted = false;
    };
  }, [hasKey]);

  // Leaflet initialization when Google Maps is not active
  useEffect(() => {
    if (mapLoaded || !isRealBrowser || !leafletContainerRef.current) return;

    if (!leafletMapRef.current) {
      const defaultCenter = validCenter ? [Number(center.lat), Number(center.lng)] : [13.0827, 80.2707];
      const lMap = L.map(leafletContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(defaultCenter, zoom || 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(lMap);

      leafletMapRef.current = lMap;

      setTimeout(() => {
        lMap.invalidateSize();
      }, 250);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletMarkersRef.current = {};
        leafletPolylineRef.current = null;
      }
    };
  }, [mapLoaded, isRealBrowser]);

  // Update center & zoom for Google Maps
  useEffect(() => {
    if (mapInstanceRef.current && validCenter) {
      mapInstanceRef.current.setCenter({ lat: Number(center.lat), lng: Number(center.lng) });
      if (zoom) mapInstanceRef.current.setZoom(zoom);
    }
  }, [center?.lat, center?.lng, zoom, validCenter]);

  // Update Google Maps markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidCoords = false;

    markers.forEach((m) => {
      if (m && m.lat != null && m.lng != null && !isNaN(m.lat) && !isNaN(m.lng)) {
        const position = { lat: Number(m.lat), lng: Number(m.lng) };
        bounds.extend(position);
        hasValidCoords = true;

        const markerOptions = {
          position,
          map: mapInstanceRef.current,
          title: m.title || "Location",
        };

        if (m.icon) {
          markerOptions.icon = m.icon;
        }

        const marker = new window.google.maps.Marker(markerOptions);
        markersRef.current.push(marker);
      }
    });

    if (markersRef.current.length > 1 && hasValidCoords) {
      mapInstanceRef.current.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    }
  }, [markers]);

  // Update Leaflet markers dynamically without reinitialization
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const lMap = leafletMapRef.current;
    const latLngs = [];

    markers.forEach((m, idx) => {
      if (m && m.lat != null && m.lng != null && !isNaN(m.lat) && !isNaN(m.lng)) {
        const key = m.title?.includes("Destination") ? "destination" : (m.title?.includes("Live") ? "provider" : `m_${idx}`);
        const pos = [Number(m.lat), Number(m.lng)];
        latLngs.push(pos);

        const isProvider = key === "provider" || m.title?.includes("Live") || m.title?.includes("🚗");
        const pinHtml = isProvider
          ? `<div class="map-marker-bubble provider"><span class="map-marker-pulse"></span><span>🚗</span><span>${m.title || "Live Provider"}</span></div><div class="map-marker-tail provider"></div>`
          : `<div class="map-marker-bubble customer"><span>📍</span><span>${m.title || "Destination"}</span></div><div class="map-marker-tail customer"></div>`;

        const icon = L.divIcon({
          className: "map-marker-pin",
          html: pinHtml,
          iconSize: [120, 38],
          iconAnchor: [60, 38],
        });

        if (leafletMarkersRef.current[key]) {
          leafletMarkersRef.current[key].setLatLng(pos);
          leafletMarkersRef.current[key].setIcon(icon);
        } else {
          const marker = L.marker(pos, { icon }).addTo(lMap);
          leafletMarkersRef.current[key] = marker;
        }
      }
    });

    if (latLngs.length > 1) {
      if (leafletPolylineRef.current) {
        leafletPolylineRef.current.setLatLngs(latLngs);
      } else {
        leafletPolylineRef.current = L.polyline(latLngs, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.85,
          dashArray: "6 6",
        }).addTo(lMap);
      }
      lMap.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 16 });
    } else if (latLngs.length === 1) {
      lMap.setView(latLngs[0], zoom || 15);
    }
  }, [markers, zoom]);

  // Google Directions renderer
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    if (route && route.origin && route.destination) {
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map: mapInstanceRef.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#3b82f6",
            strokeWeight: 4,
            strokeOpacity: 0.85,
          },
        });
      }

      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: route.origin,
          destination: route.destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRendererRef.current.setDirections(result);
            const leg = result.routes?.[0]?.legs?.[0];
            if (leg && typeof onRouteCalculated === "function") {
              onRouteCalculated({
                distanceText: leg.distance?.text,
                distanceMeters: leg.distance?.value,
                durationText: leg.duration?.text,
                durationSeconds: leg.duration?.value,
                isGoogleEta: true
              });
            }
          }
        }
      );
    } else if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
  }, [route]);

  const primaryCoord = validCenter ? center : (markers.length > 0 ? markers[0] : null);

  const handleCenter = () => {
    if (mapInstanceRef.current && validCenter) {
      mapInstanceRef.current.setCenter({ lat: Number(center.lat), lng: Number(center.lng) });
    } else if (leafletMapRef.current && validCenter) {
      leafletMapRef.current.setView([Number(center.lat), Number(center.lng)], zoom || 15, { animate: true });
    } else if (typeof onCenterClick === "function") {
      onCenterClick();
    }
  };

  return (
    <div className="google-map-wrapper" style={{ height }}>
      {/* Live Google Maps Canvas */}
      <div
        ref={containerRef}
        className="google-map-canvas"
        style={{ display: mapLoaded ? "block" : "none" }}
      />

      {/* Fallback & Leaflet Map Tile Visualization */}
      {!mapLoaded && (
        <div className="google-map-fallback" style={{ position: "relative", padding: 0 }}>
          {/* Interactive Leaflet canvas in browser */}
          {isRealBrowser && (
            <div
              ref={leafletContainerRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                height: "100%",
                zIndex: 1
              }}
            />
          )}

          {/* Test & HUD Overlay Bar */}
          <div
            style={{
              position: "relative",
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: isRealBrowser ? "flex-start" : "center",
              width: "100%",
              height: "100%",
              padding: isRealBrowser ? "12px" : "24px",
              pointerEvents: isRealBrowser ? "none" : "auto",
            }}
          >
            {!isRealBrowser && <div className="google-map-fallback-radar">📍</div>}

            <div
              className="google-map-fallback-title"
              style={{
                background: isRealBrowser ? "rgba(10, 16, 31, 0.85)" : "transparent",
                padding: isRealBrowser ? "4px 12px" : "0",
                borderRadius: 8,
                border: isRealBrowser ? "1px solid rgba(255,255,255,0.1)" : "none",
                pointerEvents: "auto",
              }}
            >
              {validCenter || primaryCoord ? "Live GPS Radar Tracking" : "Waiting for GPS Location"}
            </div>

            {primaryCoord && (
              <div
                className="google-map-fallback-coords"
                style={{
                  marginTop: 6,
                  pointerEvents: "auto",
                }}
              >
                LAT: {Number(primaryCoord.lat).toFixed(5)} | LNG: {Number(primaryCoord.lng).toFixed(5)}
              </div>
            )}

            {!isRealBrowser && (
              <div className="google-map-fallback-sub">
                {hasKey
                  ? (loadError || "Initializing Google Maps JavaScript API...")
                  : "Google Maps live visualization ready. Set VITE_GOOGLE_MAPS_API_KEY in .env to display Google satellite & street tiles."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay Status Pill */}
      {statusText && (
        <div className="google-map-status-pill">
          <span className="status-pill-dot live" />
          <span>{statusText}</span>
        </div>
      )}

      {/* Floating Center Re-focus button */}
      <div className="google-map-floating-controls">
        <button type="button" className="map-control-btn" onClick={handleCenter}>
          <span>🎯</span> Center Location
        </button>
      </div>
    </div>
  );
}
