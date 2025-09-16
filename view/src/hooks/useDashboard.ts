import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/rpc";

interface DashboardFilters {
  startDate?: string;
  endDate?: string;
}

export const useDashboardMetrics = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ["dashboard-metrics", filters],
    queryFn: () => client.GET_DASHBOARD_METRICS(filters),
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchOnWindowFocus: false,
  });
};
