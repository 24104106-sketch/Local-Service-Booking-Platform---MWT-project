import { io } from 'socket.io-client';
import { getAuthToken } from './apiClient';

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '') ||
  (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : '') ||
  'http://localhost:5000';

let socket = null;
const activeBookingRooms = new Map(); // bookingId -> count of active component subscriptions
const connectionListeners = new Set();

export const getSocket = () => {
  const token = getAuthToken();
  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token: token ? `Bearer ${token}` : null
      }
    });

    // Auto rejoin active booking rooms on connect / reconnect
    socket.on('connect', () => {
      try {
        const rawUser = localStorage.getItem('fixit_local_user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u?.id) {
            const token = getAuthToken();
            socket.emit('join_user', u.id, token ? `Bearer ${token}` : null);
          }
        }
      } catch (_) {}

      activeBookingRooms.forEach((count, bId) => {
        if (count > 0) {
          socket.emit('join_booking', bId);
        }
      });
      connectionListeners.forEach((fn) => {
        try { fn(true); } catch (_) {}
      });
    });

    socket.on('disconnect', (reason) => {
      connectionListeners.forEach((fn) => {
        try { fn(false, reason); } catch (_) {}
      });
    });

    socket.on('connect_error', (err) => {
      connectionListeners.forEach((fn) => {
        try { fn(false, err?.message || 'Connection error'); } catch (_) {}
      });
    });
  } else if (token) {
    socket.auth = { token: `Bearer ${token}` };
  }
  return socket;
};

export const isSocketConnected = () => {
  return !!(socket && socket.connected);
};

export const onSocketConnectionChange = (callback) => {
  if (typeof callback !== 'function') return () => {};
  connectionListeners.add(callback);
  // Initial immediate call with current state
  callback(isSocketConnected());
  return () => {
    connectionListeners.delete(callback);
  };
};

export const connectSocket = (userId) => {
  const s = getSocket();
  const token = getAuthToken();
  if (token) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (!s.connected) {
    s.connect();
  }
  if (userId) {
    s.emit('join_user', userId, token ? `Bearer ${token}` : null);
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export const subscribeToBookingUpdates = (bookingId, { onLocation, onStatus, onMessage, onAdditionalCharge } = {}) => {
  if (!bookingId) return () => {};

  const s = getSocket();
  const currentToken = getAuthToken();
  if (currentToken) {
    s.auth = { token: `Bearer ${currentToken}` };
  }

  if (!s.connected) {
    s.connect();
  }

  // Register room in active registry
  const currentCount = activeBookingRooms.get(bookingId) || 0;
  activeBookingRooms.set(bookingId, currentCount + 1);

  // Join the booking room
  s.emit('join_booking', bookingId);

  // Safe normalized location listener supporting both event names
  const handleLocation = (data) => {
    if (!data) return;
    const rawLat = data.latitude ?? data.lat;
    const rawLng = data.longitude ?? data.lng;
    const nLat = Number(rawLat);
    const nLng = Number(rawLng);

    if (isNaN(nLat) || isNaN(nLng)) return;

    if (typeof onLocation === 'function') {
      onLocation({
        bookingId: data.bookingId,
        bookingNumber: data.bookingNumber,
        providerId: data.providerId,
        latitude: nLat,
        longitude: nLng,
        lat: nLat,
        lng: nLng,
        heading: Number(data.heading || 0),
        speed: Number(data.speed || 0),
        accuracy: data.accuracy != null ? Number(data.accuracy) : null,
        timestamp: data.timestamp || new Date().toISOString()
      });
    }
  };

  const handleStatus = (data) => {
    if (typeof onStatus === 'function') {
      onStatus(data);
    }
  };

  const handleMessage = (data) => {
    if (typeof onMessage === 'function') {
      onMessage(data);
    }
  };

  const handleCharge = (data) => {
    if (typeof onAdditionalCharge === 'function') {
      onAdditionalCharge(data);
    }
  };

  // Register event listeners
  if (onLocation) {
    s.on('provider_location_update', handleLocation);
    s.on('provider_location_updated', handleLocation);
  }
  if (onStatus) {
    s.on('booking_status_update', handleStatus);
  }
  if (onMessage) {
    s.on('new_booking_message', handleMessage);
  }
  if (onAdditionalCharge) {
    s.on('additional_charge_requested', handleCharge);
  }

  // Cleanup handler
  return () => {
    if (onLocation) {
      s.off('provider_location_update', handleLocation);
      s.off('provider_location_updated', handleLocation);
    }
    if (onStatus) {
      s.off('booking_status_update', handleStatus);
    }
    if (onMessage) {
      s.off('new_booking_message', handleMessage);
    }
    if (onAdditionalCharge) {
      s.off('additional_charge_requested', handleCharge);
    }

    const updatedCount = (activeBookingRooms.get(bookingId) || 1) - 1;
    if (updatedCount <= 0) {
      activeBookingRooms.delete(bookingId);
      s.emit('leave_booking', bookingId);
    } else {
      activeBookingRooms.set(bookingId, updatedCount);
    }
  };
};

export const emitProviderLocation = (bookingId, locationData) => {
  if (!bookingId || !locationData) return;
  const s = getSocket();
  const currentToken = getAuthToken();
  if (currentToken) {
    s.auth = { token: `Bearer ${currentToken}` };
  }
  if (!s.connected) {
    s.connect();
  }

  const rawLat = locationData.latitude ?? locationData.lat;
  const rawLng = locationData.longitude ?? locationData.lng;
  const nLat = Number(rawLat);
  const nLng = Number(rawLng);

  if (isNaN(nLat) || isNaN(nLng)) return;

  s.emit('provider_location_update', {
    bookingId,
    latitude: nLat,
    longitude: nLng,
    lat: nLat,
    lng: nLng,
    heading: Number(locationData.heading || 0),
    speed: Number(locationData.speed || 0),
    accuracy: locationData.accuracy != null ? Number(locationData.accuracy) : null,
    timestamp: locationData.timestamp || new Date().toISOString()
  });
};

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  isSocketConnected,
  onSocketConnectionChange,
  subscribeToBookingUpdates,
  emitProviderLocation
};
