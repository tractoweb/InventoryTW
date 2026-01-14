"use client";

import { formatDateTimeInBogota } from "@/lib/datetime";

export const DateCell = ({ dateString }: { dateString?: string | null }) => {
    if (!dateString) {
      return <div>—</div>;
    }

    return <div>{formatDateTimeInBogota(dateString, { second: undefined })}</div>;
  }
  