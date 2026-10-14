import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

// Encodes a plain Google Maps link (or custom URL) so any phone's
// default camera app recognizes it and offers to open Maps directly.
function LocationQR({ lat, lng, url, size = 160, label = "Scan with your phone's camera to open the exact location in Maps" }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  const targetUrl = url || (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : "");

  useEffect(() => {
    if (!canvasRef.current || !targetUrl) return;
    QRCode.toCanvas(
      canvasRef.current,
      targetUrl,
      {
        width: size,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      },
      (err) => {
        if (err) setError(true);
      }
    );
  }, [targetUrl, size]);

  if (!targetUrl) return null;
  if (error) return <p style={{ color: "var(--red)", fontSize: 12 }}>Couldn't generate QR code.</p>;

  return (
    <div style={{ textAlign: "center", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          padding: 8,
          background: "#ffffff",
          borderRadius: 12,
          display: "inline-block",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 6 }} />
      </div>
      {label && (
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, maxWidth: size + 60, lineHeight: 1.35 }}>
          {label}
        </p>
      )}
    </div>
  );
}

export default LocationQR;
