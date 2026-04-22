import { trpc } from "@/lib/trpc";

export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user: meQuery.data ?? { name: "Guest" },
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => meQuery.refetch(),
    logout: async () => {},
  };
}