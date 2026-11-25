import { useEffect, useState } from "react";

// Starts from the request-time clock the server rendered with (so hydration matches), then ticks every minute.
export function useNow(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return new Date(now);
}
