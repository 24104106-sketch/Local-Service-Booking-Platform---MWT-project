import { useContext } from "react";
import { ToastContext } from "../context/ToastContext";

/**
 * Custom hook — call showToast(message, type) from anywhere to pop a toast.
 * type is "success" | "error" | "info".
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast("Booking confirmed!", "success");
 */
export function useToast() {
  return useContext(ToastContext);
}
