"use client"; // error boundaries must be Client Components

import { ErrorScreen } from "@/components/ErrorScreen";

// retry() re-fetches and re-renders the segment (Next 16; reset() would only re-render)
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen retry={retry} />;
}
