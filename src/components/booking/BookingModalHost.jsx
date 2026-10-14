import { Suspense, lazy } from "react";
import Modal from "../Modal";
import Skeleton from "../Skeleton";
import ChatPanel from "../ChatPanel";
import BookingDetailsModal from "../BookingDetailsModal";

const ProviderTrackingMap = lazy(() => import("../maps/ProviderTrackingMap"));
const LocationQR = lazy(() => import("../LocationQR"));

/**
 * Reusable host for booking-related modals (Details, Live Tracking, Chat, Location QR).
 */
function BookingModalHost({
  detailsBooking,
  onCloseDetails,
  trackingBooking,
  onCloseTracking,
  chattingBooking,
  onCloseChatting,
  locationBooking,
  onCloseLocation,
  role = "customer",
  currentUserName,
  onOpenTrack,
  onOpenChat,
}) {
  return (
    <>
      {detailsBooking && (
        <BookingDetailsModal
          booking={detailsBooking}
          onClose={onCloseDetails}
          onTrack={onOpenTrack}
          onChat={onOpenChat}
        />
      )}

      {trackingBooking && (
        <Modal
          title={`🚚 Tracking — ${role === "customer" ? trackingBooking.provider : trackingBooking.customer}`}
          onClose={onCloseTracking}
          width={560}
        >
          <Suspense fallback={<Skeleton variant="card" count={1} height={260} />}>
            <ProviderTrackingMap
              bookingId={trackingBooking.id}
              destination={trackingBooking.serviceLocation || trackingBooking.service_location || trackingBooking.location}
              initialProviderLocation={trackingBooking.providerLocation || trackingBooking.provider_location}
              providerName={trackingBooking.provider}
              status={trackingBooking.status}
              height="320px"
            />
          </Suspense>
        </Modal>
      )}

      {chattingBooking && (
        <Modal
          title={`💬 ${role === "customer" ? chattingBooking.provider : chattingBooking.customer}`}
          onClose={onCloseChatting}
          width={420}
        >
          <ChatPanel
            booking={chattingBooking}
            role={role}
            myName={currentUserName}
          />
        </Modal>
      )}

      {locationBooking && (
        <Modal
          title={`📍 ${locationBooking.customer}'s Location`}
          onClose={onCloseLocation}
          width={380}
        >
          {locationBooking.location ? (
            <Suspense fallback={<Skeleton variant="card" count={1} height={180} />}>
              <LocationQR
                lat={locationBooking.location.lat}
                lng={locationBooking.location.lng}
              />
            </Suspense>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 12.5 }}>
              This customer hasn't shared their exact GPS location for this booking.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

export default BookingModalHost;
