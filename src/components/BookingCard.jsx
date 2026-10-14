import { memo } from "react";
import Badge from "./Badge";
import { getServiceCoverImage } from "../utils/serviceImages";

function BookingCard({ booking, onClick }) {
  const { service, provider, date, status, category } = booking;
  const coverImg = getServiceCoverImage(service, category);

  return (
    <div
      className="booking-card"
      onClick={onClick ? () => onClick(booking) : undefined}
      style={{
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <img
        src={coverImg}
        alt={service}
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          objectFit: "cover",
          border: "1px solid var(--border)",
          flexShrink: 0,
          background: "var(--surface)",
        }}
        loading="lazy"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="service-name">{service}</div>
        <div className="provider-name">{provider} • {date}</div>
      </div>
      <Badge status={status} />
    </div>
  );
}

export default memo(BookingCard);
