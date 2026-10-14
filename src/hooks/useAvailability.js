import { useContext, useCallback, useMemo } from "react";
import { AvailabilityContext } from "../context/AvailabilityContext";
import { useAuth } from "./useAuth";
import {
  fetchProviderDailyScheduleApi,
  saveProviderDailyScheduleApi,
  addProviderBusyIntervalApi,
  deleteProviderBusyIntervalApi,
  quickActionAvailabilityApi,
  restoreDailyAvailabilityApi,
  fetchProviderSlotsApi,
} from "../api/realApi";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_SLOTS = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM", "07:00 PM"];

/**
 * Hook for managing provider availability and retrieving available slots for a given date.
 */
export function useAvailability() {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error("useAvailability must be used within an AvailabilityProvider");
  }

  const { user } = useAuth();
  const { schedules, hydrated, getSchedule, setSchedule, addSlot: addSlotDirect, removeSlot: removeSlotDirect } = context;

  const currentProviderSchedule = useMemo(() => {
    return getSchedule(user?.name);
  }, [getSchedule, user?.name]);

  /**
   * Synchronous / client-side slot resolution fallback (maintains compatibility with existing tests and offline modes)
   */
  const getSlotsForDate = useCallback(
    (providerName, dateInput, existingBookings = []) => {
      if (!dateInput) return [];

      const parsedDate = new Date(dateInput);
      if (Number.isNaN(parsedDate.getTime())) return DEFAULT_SLOTS;

      // Check if date is in the past (before today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(parsedDate);
      targetDate.setHours(0, 0, 0, 0);
      if (targetDate < today) return [];

      const dayName = DAYS_OF_WEEK[parsedDate.getDay()];
      const providerSchedule = getSchedule(providerName);
      const dayConfig = providerSchedule.find((d) => d.day.toLowerCase() === dayName.toLowerCase());

      // If provider has no slots configured on this day, day is unavailable
      if (!dayConfig || !dayConfig.slots || dayConfig.slots.length === 0) {
        return [];
      }

      let rawSlots = [];
      dayConfig.slots.forEach((slotStr) => {
        rawSlots.push(slotStr);
      });

      // Filter out slots already booked with this provider on this formatted date
      const formattedTarget = parsedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const bookedTimes = new Set(
        existingBookings
          .filter(
            (b) =>
              b.provider === providerName &&
              (b.date === formattedTarget || b.date === dateInput) &&
              b.status !== "Cancelled" &&
              b.status !== "Rejected"
          )
          .map((b) => b.time)
      );

      return rawSlots.filter((slot) => !bookedTimes.has(slot));
    },
    [getSchedule]
  );

  /**
   * Async backend slot fetcher: retrieves authoritative daily availability & slots from backend
   */
  const fetchSlotsForProviderAndDate = useCallback(
    async (providerId, dateInput, serviceDuration = null) => {
      if (!providerId || !dateInput) return { availableSlots: [], allSlots: [], isFullyBooked: true };
      try {
        const response = await fetchProviderSlotsApi(providerId, dateInput, serviceDuration);
        const data = response.data || response;
        return {
          date: data.date || dateInput,
          availableSlots: Array.isArray(data.availableSlots) ? data.availableSlots : [],
          allSlots: Array.isArray(data.allSlots) ? data.allSlots : [],
          bookedSlots: Array.isArray(data.bookedSlots) ? data.bookedSlots : [],
          busyIntervals: Array.isArray(data.busyIntervals) ? data.busyIntervals : [],
          isFullyBooked: Boolean(data.isFullyBooked),
          isDayOff: Boolean(data.isDayOff),
          workingHours: data.workingHours || { start: "09:00 AM", end: "06:00 PM" },
          message: data.message || "",
        };
      } catch (err) {
        console.warn("[useAvailability] Backend slot fetch failed, using local calculation:", err.message);
        const fallback = getSlotsForDate(user?.name, dateInput);
        return {
          date: dateInput,
          availableSlots: fallback,
          allSlots: fallback,
          bookedSlots: [],
          busyIntervals: [],
          isFullyBooked: fallback.length === 0,
          isDayOff: false,
        };
      }
    },
    [getSlotsForDate, user?.name]
  );

  /**
   * Provider Daily Schedule management APIs
   */
  const fetchDailySchedule = useCallback(async (date) => {
    try {
      const response = await fetchProviderDailyScheduleApi(date);
      return response.data || response;
    } catch (err) {
      console.error("[useAvailability] Failed to fetch daily schedule:", err);
      throw err;
    }
  }, []);

  const saveDailySchedule = useCallback(async (data) => {
    try {
      const response = await saveProviderDailyScheduleApi(data);
      return response.data || response;
    } catch (err) {
      console.error("[useAvailability] Failed to save daily schedule:", err);
      throw err;
    }
  }, []);

  const addBusyInterval = useCallback(async (data) => {
    try {
      const response = await addProviderBusyIntervalApi(data);
      return response.data || response;
    } catch (err) {
      console.error("[useAvailability] Failed to add busy interval:", err);
      throw err;
    }
  }, []);

  const deleteBusyInterval = useCallback(async (intervalId, date) => {
    try {
      const response = await deleteProviderBusyIntervalApi(intervalId, date);
      return response.data || response;
    } catch (err) {
      console.error("[useAvailability] Failed to delete busy interval:", err);
      throw err;
    }
  }, []);

  const quickAction = useCallback(async (data) => {
    try {
      const response = await quickActionAvailabilityApi(data);
      return response.data || response;
    } catch (err) {
      console.error("[useAvailability] Failed quick action:", err);
      throw err;
    }
  }, []);

  const restoreDailySchedule = useCallback(async (date) => {
    try {
      const response = await restoreDailyAvailabilityApi(date);
      return response.data || response;
    } catch (err) {
      console.error("[useAvailability] Failed to restore daily schedule:", err);
      throw err;
    }
  }, []);

  const updateScheduleForCurrentProvider = useCallback(
    (schedule) => {
      if (user?.name) {
        setSchedule(user.name, schedule);
      }
    },
    [setSchedule, user?.name]
  );

  const addSlot = useCallback(
    (day, slot) => {
      if (user?.name) {
        addSlotDirect(user.name, day, slot);
      }
    },
    [addSlotDirect, user?.name]
  );

  const removeSlot = useCallback(
    (day, slot) => {
      if (user?.name) {
        removeSlotDirect(user.name, day, slot);
      }
    },
    [removeSlotDirect, user?.name]
  );

  return {
    schedule: currentProviderSchedule,
    loading: !hydrated,
    getSchedule,
    setSchedule,
    getSlotsForDate,
    fetchSlotsForProviderAndDate,
    fetchDailySchedule,
    saveDailySchedule,
    addBusyInterval,
    deleteBusyInterval,
    quickAction,
    restoreDailySchedule,
    updateSchedule: updateScheduleForCurrentProvider,
    addSlot,
    removeSlot,
  };
}
