import { useEffect, useRef } from "react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { router } from "@/app/router/router";
import type { AuthState } from "./types";

export function useAuth(): AuthState {
  const { isLoaded, isSignedIn, userId } = useClerkAuth();

  let state: AuthState;
  if (!isLoaded) {
    state = { status: "loading" };
  } else if (isSignedIn && userId) {
    state = { status: "signed-in", userId };
  } else {
    state = { status: "signed-out" };
  }

  const prevStatusRef = useRef(state.status);
  useEffect(() => {
    if (prevStatusRef.current !== state.status) {
      prevStatusRef.current = state.status;
      void router.invalidate();
    }
  }, [state.status]);

  return state;
}
