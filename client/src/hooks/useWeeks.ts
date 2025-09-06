import { useQuery } from "@tanstack/react-query";
import type { AdWeek } from "@shared/schema";

export function useWeeks() {
  return useQuery<AdWeek[]>({
    queryKey: ['/api/weeks'],
  });
}

export function useWeek(id: string) {
  return useQuery<AdWeek>({
    queryKey: ['/api/weeks', id],
    enabled: !!id,
  });
}
