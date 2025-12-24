"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function AwsStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate connection status changes
      setIsConnected(Math.random() > 0.2);
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className={cn(
          "h-3 w-3 rounded-full animate-pulse",
          isConnected ? "bg-green-500" : "bg-red-500"
        )}
      />
      <div className="flex-1">
        <p className="text-sm font-medium">AWS RDS</p>
        <p className="text-xs text-muted-foreground">
          {isConnected ? "Connected" : "Disconnected"}
        </p>
      </div>
    </div>
  );
}
