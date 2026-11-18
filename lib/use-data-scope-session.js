"use client";

import { authClient } from "./auth-client.js";
import { useMemo } from "react";
import { useGetCurrentUserQuery } from "../store/services/data-scope-api.js";

// Use Better Auth for session validity and the protected backend's current-user
// response for live roles and permissions. RTK Query shares and refreshes this
// request across protected screens.
export function useDataScopeSession() {
  const authState = authClient.useSession();
  const { data: currentUserResult } = useGetCurrentUserQuery(undefined, {
    skip: authState.isPending || !authState.data,
    pollingInterval: 30_000,
    refetchOnFocus: true,
  });

  const session = useMemo(
    () => authState.data
      ? {
          ...authState.data,
          user: currentUserResult?.user ?? authState.data.user,
        }
      : authState.data,
    [authState.data, currentUserResult?.user],
  );

  return { ...authState, data: session };
}
