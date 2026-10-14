/**
 * Geolocation and Reverse Geocoding Utilities
 * Uses real browser GPS and geocoding services.
 */

export const getCurrentCoordinates = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by your browser. Please enter the address manually."));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          return reject(new Error("Invalid GPS coordinates received from device."));
        }
        resolve({
          latitude,
          longitude,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || null,
          timestamp: position.timestamp || Date.now(),
        });
      },
      (error) => {
        let msg = "Location permission denied. Please enter the address manually.";
        if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "GPS location unavailable. Please enter the address manually.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Location request timed out. Please enter the address manually.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
};

export const reverseGeocode = async (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (isNaN(lat) || isNaN(lng)) return "Coordinates provided";

  // 1. Try Google Maps Geocoder if available
  if (window.google && window.google.maps && window.google.maps.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            resolve(results[0].formatted_address);
          } else {
            reject(new Error(status));
          }
        });
      });
      if (res) return res;
    } catch {
      // Fall through to open geocoding
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim for dev without Google Maps API Key
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { "Accept-Language": "en" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch {
    // Silent catch for network or offline
  }

  // 3. Coordinate label fallback
  return `GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
};

/**
 * Calculates straight-line / great-circle distance using Haversine formula (in km)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

/**
 * Estimates arrival time in minutes based on distance (default ~24 km/h urban speed)
 */
export const calculateEtaMinutes = (distanceKm, averageSpeedKmH = 24) => {
  if (distanceKm <= 0.05) return 0;
  const hours = distanceKm / averageSpeedKmH;
  return Math.max(1, Math.round(hours * 60));
};

/**
 * Resolves address text to real latitude and longitude
 */
export const forwardGeocode = async (address) => {
  if (!address || typeof address !== "string" || !address.trim()) return null;
  const query = address.trim();

  // 1. Google Maps Geocoder if available
  if (window.google && window.google.maps && window.google.maps.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: query }, (results, status) => {
          if (status === "OK" && results && results[0] && results[0].geometry) {
            resolve({
              latitude: results[0].geometry.location.lat(),
              longitude: results[0].geometry.location.lng(),
              formattedAddress: results[0].formatted_address,
            });
          } else {
            reject(new Error(status));
          }
        });
      });
      if (res) return res;
    } catch {
      // Fall through to OpenStreetMap
    }
  }

  // 2. OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { "Accept-Language": "en" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0 && data[0].lat && data[0].lon) {
        return {
          latitude: Number(data[0].lat),
          longitude: Number(data[0].lon),
          formattedAddress: data[0].display_name,
        };
      }
    }
  } catch {
    // Silent catch
  }

  return null;
};
