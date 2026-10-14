import { useCallback } from "react";
import { useSettingsStore } from "./useSettingsStore";

/**
 * Custom hook — single source of truth for the customer's saved addresses.
 * This is the SAME "addresses" settings-store namespace the Settings >
 * Location & Address tab already reads/writes (see AddressTab in
 * pages/customer/Settings.jsx) — extracted here so the booking wizard can
 * select from, and add to, that exact list instead of a second address
 * store living only inside the booking flow.
 *
 * Usage:
 *   const { addresses, addAddress, removeAddress } = useAddresses();
 *   addAddress("Home", "12 Anna Nagar, Chennai");
 */
export function useAddresses() {
  const [addresses, updateAddresses] = useSettingsStore("addresses", { saved: [] });

  const addAddress = useCallback(
    (label, line) => {
      if (!line?.trim()) return null;
      const newAddress = { id: Date.now(), label: label || "Other", line: line.trim() };
      updateAddresses({ saved: [...addresses.saved, newAddress] });
      return newAddress;
    },
    [addresses.saved, updateAddresses]
  );

  const removeAddress = useCallback(
    (id) => updateAddresses({ saved: addresses.saved.filter((a) => a.id !== id) }),
    [addresses.saved, updateAddresses]
  );

  return { addresses: addresses.saved, addAddress, removeAddress };
}
