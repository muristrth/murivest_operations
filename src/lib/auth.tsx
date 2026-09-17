import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./constants";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  job_title: string;
  phone: string | null;
  active: boolean;
};

type AuthValue = {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  role: AppRole | null;
  permissions: string[];
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  refresh: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const identity = useQuery({
    queryKey: ["identity", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!).maybeSingle(),
      ]);
      if (profileRes.error) throw profileRes.error;
      const role = (roleRes.data?.role ?? null) as AppRole | null;
      let permissions: string[] = [];
      if (role) {
        const perms = await supabase
          .from("role_permissions")
          .select("permission")
          .eq("role", role);
        permissions = (perms.data ?? []).map((p) => p.permission);
      }
      return { profile: (profileRes.data as Profile) ?? null, role, permissions };
    },
  });

  const permissions = identity.data?.permissions ?? [];

  const value: AuthValue = {
    session,
    loading: loading || (!!userId && identity.isLoading),
    profile: identity.data?.profile ?? null,
    role: identity.data?.role ?? null,
    permissions,
    can: (permission) => permissions.includes(permission),
    canAny: (...list) => list.some((p) => permissions.includes(p)),
    refresh: () => identity.refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export async function signOutAndRedirect(queryClient: {
  cancelQueries: () => Promise<void>;
  clear: () => void;
}) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
}
