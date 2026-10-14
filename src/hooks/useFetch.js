import { useState, useEffect } from "react";

/**
 * Custom hook — wraps the repetitive "call an API function, track
 * loading/error/data" pattern that used to be copy-pasted into every page.
 *
 * Usage:
 *   const { data: bookings, loading, error } = useFetch(fetchBookings);
 */
export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true; // avoids setting state after the component unmounts
    setLoading(true);
    setError(null);

    fetchFn()
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
