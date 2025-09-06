import { useQuery } from "@tanstack/react-query";
import type { DealRow, Score } from "@shared/schema";

interface DealWithScore extends DealRow {
  score?: Score;
}

export function useDeals(weekId: string) {
  return useQuery<DealWithScore[]>({
    queryKey: ['/api/weeks', weekId, 'deals'],
    enabled: !!weekId,
  });
}

export function useDeal(weekId: string, dealId: string) {
  return useQuery<DealWithScore>({
    queryKey: ['/api/weeks', weekId, 'deals', dealId],
    enabled: !!weekId && !!dealId,
  });
}
