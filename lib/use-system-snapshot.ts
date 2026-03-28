"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormPilotState } from "@/lib/types";

const emptySnapshot: FormPilotState = {
  profile: null,
  preferences: null,
  linkedinSession: null,
  jobs: [],
  applications: [],
  queue: {
    jobScraping: [],
    application: []
  },
  activity: []
};

export function useSystemSnapshot() {
  const [snapshot, setSnapshot] = useState<FormPilotState>(emptySnapshot);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    const nextSnapshot = (await response.json()) as FormPilotState;
    setSnapshot(nextSnapshot);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  return {
    snapshot,
    loading,
    refresh
  };
}
