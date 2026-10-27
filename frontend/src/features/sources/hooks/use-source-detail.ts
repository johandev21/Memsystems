import { useQuery } from "@tanstack/react-query";
import { sourceQueryOptions } from "../api/sources";
import type { SourceWithContent } from "../types/source.types";
import {
  isSourceProcessing,
  SOURCE_POLL_INTERVAL_MS,
} from "../utils/source-processing";

export function useSourceDetail(sourceId: string) {
  return useQuery({
    ...sourceQueryOptions(sourceId),
    staleTime: 0,
    refetchInterval: (query) => {
      const current = query.state.data as SourceWithContent | undefined;
      return current && isSourceProcessing(current) ? SOURCE_POLL_INTERVAL_MS : false;
    },
  });
}
