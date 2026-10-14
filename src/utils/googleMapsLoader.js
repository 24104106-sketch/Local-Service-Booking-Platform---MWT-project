/**
 * Google Maps JavaScript API Dynamic Loader
 * Safely loads Google Maps script once using VITE_GOOGLE_MAPS_API_KEY.
 */

let loadPromise = null;

export const getGoogleMapsApiKey = () => {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
};

export const loadGoogleMapsScript = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser environment required"));

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
    loadPromise = Promise.reject(new Error("GOOGLE_MAPS_KEY_MISSING"));
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script tag is already in DOM
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google.maps));
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.type = "text/javascript";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps script loaded but window.google.maps is undefined"));
      }
    };

    script.onerror = (err) => {
      loadPromise = null;
      reject(err);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
};
