import { createContext, useCallback } from "react";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

export const AvailabilityContext = createContext(null);

const STORAGE_KEY = "fixit_local_provider_availability";

export const DEFAULT_PROVIDER_AVAILABILITY = [
  { day: "Monday", slots: ["09:00 AM - 01:00 PM", "03:00 PM - 07:00 PM"] },
  { day: "Tuesday", slots: ["09:00 AM - 01:00 PM"] },
  { day: "Wednesday", slots: [] },
  { day: "Thursday", slots: ["11:00 AM - 06:00 PM"] },
  { day: "Friday", slots: ["09:00 AM - 01:00 PM", "03:00 PM - 07:00 PM"] },
  { day: "Saturday", slots: ["10:00 AM - 04:00 PM"] },
  { day: "Sunday", slots: [] },
];

// Initial seed map: provider name -> weekly schedule array
const INITIAL_AVAILABILITY = {
  default: DEFAULT_PROVIDER_AVAILABILITY,
};

function availabilityReducer(state, action) {
  switch (action.type) {
    case "SET":
      return typeof action.payload === "object" && action.payload ? action.payload : INITIAL_AVAILABILITY;
    case "SET_PROVIDER_SCHEDULE":
      return {
        ...state,
        [action.provider]: action.schedule,
      };
    case "ADD_SLOT": {
      const schedule = state[action.provider] || state.default || DEFAULT_PROVIDER_AVAILABILITY;
      const updated = schedule.map((d) =>
        d.day === action.day && !d.slots.includes(action.slot) ? { ...d, slots: [...d.slots, action.slot] } : d
      );
      return { ...state, [action.provider]: updated };
    }
    case "REMOVE_SLOT": {
      const schedule = state[action.provider] || state.default || DEFAULT_PROVIDER_AVAILABILITY;
      const updated = schedule.map((d) =>
        d.day === action.day ? { ...d, slots: d.slots.filter((s) => s !== action.slot) } : d
      );
      return { ...state, [action.provider]: updated };
    }
    default:
      return state;
  }
}

export function AvailabilityProvider({ children }) {
  const [schedules, dispatch, hydrated] = usePersistentReducer(
    availabilityReducer,
    INITIAL_AVAILABILITY,
    STORAGE_KEY,
    () => INITIAL_AVAILABILITY
  );

  const getSchedule = useCallback(
    (providerName) => {
      return schedules[providerName] || schedules.default || DEFAULT_PROVIDER_AVAILABILITY;
    },
    [schedules]
  );

  const setSchedule = useCallback(
    (providerName, schedule) => {
      dispatch({ type: "SET_PROVIDER_SCHEDULE", provider: providerName, schedule });
    },
    [dispatch]
  );

  const addSlot = useCallback(
    (providerName, day, slot) => {
      dispatch({ type: "ADD_SLOT", provider: providerName, day, slot });
    },
    [dispatch]
  );

  const removeSlot = useCallback(
    (providerName, day, slot) => {
      dispatch({ type: "REMOVE_SLOT", provider: providerName, day, slot });
    },
    [dispatch]
  );

  return (
    <AvailabilityContext.Provider
      value={{
        schedules,
        hydrated,
        getSchedule,
        setSchedule,
        addSlot,
        removeSlot,
      }}
    >
      {children}
    </AvailabilityContext.Provider>
  );
}
