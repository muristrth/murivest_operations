import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { LoadingState } from "@/components/app/ui-kit";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, role, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="surface max-w-md rounded-md p-8 text-center">
          <p className="wordmark text-lg text-foreground">MURIVEST</p>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Awaiting role assignment
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({profile?.email}) has been created but no role has been assigned
            yet. The Managing Director must assign your role before you can access the
            internal system.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth/login";
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
