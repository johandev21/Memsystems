import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitSourceTranscript } from "../api/sources";

export function useSubmitSourceTranscript(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transcript: string) => submitSourceTranscript(sourceId, transcript),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
}
