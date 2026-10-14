import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { calculateDistance, calculateEtaMinutes, getCurrentCoordinates } from "../utils/geocode";
import ProviderTrackingMap from "../components/maps/ProviderTrackingMap";
import GoogleMap from "../components/maps/GoogleMap";

describe("Real Location Utilities (geocode.js)", () => {
  it("calculates accurate Haversine distance between two real coordinates", () => {
    // Distance between Central Park NY (40.785091, -73.968285) and Times Square NY (40.758896, -73.985130)
    // Approximately 3.2 - 3.4 km
    const dist = calculateDistance(40.785091, -73.968285, 40.758896, -73.985130);
    expect(dist).toBeGreaterThan(2.9);
    expect(dist).toBeLessThan(3.8);
  });

  it("returns 0 distance for identical coordinates", () => {
    const dist = calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);
    expect(dist).toBe(0);
  });

  it("calculates reasonable driving ETA in minutes", () => {
    // 5 km trip at urban speed (~25 km/h) plus base margin (~3 min) ≈ 15 mins
    const eta = calculateEtaMinutes(5);
    expect(eta).toBeGreaterThanOrEqual(12);
    expect(eta).toBeLessThanOrEqual(20);
  });

  it("getCurrentCoordinates resolves browser navigator.geolocation", async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) =>
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 15,
          },
        })
      ),
    };
    vi.stubGlobal("navigator", { geolocation: mockGeolocation });

    const coords = await getCurrentCoordinates();
    expect(coords.latitude).toBe(37.7749);
    expect(coords.longitude).toBe(-122.4194);
    expect(coords.accuracy).toBe(15);
  });

  it("getCurrentCoordinates rejects when geolocation permission is denied", async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_, error) =>
        error({
          code: 1,
          PERMISSION_DENIED: 1,
          message: "User denied Geolocation",
        })
      ),
    };
    vi.stubGlobal("navigator", { geolocation: mockGeolocation });

    await expect(getCurrentCoordinates()).rejects.toThrow(
      "Location permission denied"
    );
  });
});

describe("GoogleMap Component Graceful Fallback", () => {
  it("renders live GPS Radar fallback when Google Maps API key is not configured", () => {
    render(
      <GoogleMap
        center={{ lat: 37.7749, lng: -122.4194 }}
        statusText="Waiting for Provider GPS"
        markers={[{ lat: 37.7749, lng: -122.4194, title: "Destination" }]}
      />
    );

    expect(screen.getByText(/Live GPS Radar Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/LAT:\s*37\.77490\s*\|\s*LNG:\s*-122\.41940/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for Provider GPS/i)).toBeInTheDocument();
  });
});

describe("ProviderTrackingMap Component", () => {
  it("renders tracking map with destination coordinates", () => {
    render(
      <ProviderTrackingMap
        bookingId="test-booking-1"
        destination={{ lat: 12.9716, lng: 77.5946, address: "MG Road, Bengaluru" }}
        providerName="Alex Builder"
        status="on_the_way"
      />
    );

    expect(screen.getByText(/Live GPS Radar Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for Provider GPS/i)).toBeInTheDocument();
  });

  it("notifies parent of initial metrics when destination is provided", () => {
    const metricsCallback = vi.fn();
    render(
      <ProviderTrackingMap
        bookingId="test-booking-2"
        destination={{ lat: 12.9716, lng: 77.5946, address: "MG Road, Bengaluru" }}
        initialProviderLocation={{ lat: 12.9750, lng: 77.5900 }}
        providerName="Alex Builder"
        status="on_the_way"
        onMetricsUpdate={metricsCallback}
      />
    );

    expect(metricsCallback).toHaveBeenCalled();
    const lastCall = metricsCallback.mock.calls[metricsCallback.mock.calls.length - 1][0];
    expect(lastCall.hasProviderGps).toBe(true);
    expect(lastCall.distanceKm).toContain("km");
    expect(lastCall.etaMinutes).toContain("mins");
  });
});
