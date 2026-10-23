"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PlanFeature } from "@prisma/client";

const PlanContext = createContext<PlanFeature[]>([]);

export function PlanProvider({ features, children }: { features: PlanFeature[]; children: ReactNode }) {
  return <PlanContext.Provider value={features}>{children}</PlanContext.Provider>;
}

export function useFeature(feature: PlanFeature) {
  return useContext(PlanContext).includes(feature);
}
