import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { COMPANY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/ui-kit";

export const Route = createFileRoute("/auth/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Murivest Internal System" },
      {
        name: "description",
        content: "Secure staff sign-in for the Murivest Group Ltd. internal operating system.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign_in" | "register">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(
            /invalid login/i.test(error.message)
              ? "Incorrect email address or password."
              : error.message,
          );
          return;
        }
        navigate({ to: "/app/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/dashboard`,
            data: { full_name: fullName, job_title: jobTitle || undefined },
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (data.session) {
          navigate({ to: "/app/dashboard", replace: true });
        } else {
          toast.success("Account created. Please confirm your email address to sign in.");
          setMode("sign_in");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-sidebar px-12 py-14 text-sidebar-foreground lg:flex">
        <div>
          <img
            src={COMPANY.logo}
            alt={COMPANY.name}
            className="mb-4 h-12 w-auto object-contain"
          />
          <p className="wordmark text-2xl text-sidebar-primary">MURIVEST</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-sidebar-foreground/60">
            Group Ltd.
          </p>
        </div>
        <div className="max-w-md">
          <h2 className="font-serif text-3xl leading-snug text-sidebar-accent-foreground">
            Internal Operations, Secretariat &amp; Capital Advisory
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/70">
            A single, auditable record of every call, inquiry, appointment, follow-up and
            property decision across the firm.
          </p>
          <div className="mt-10 h-px w-24 bg-sidebar-primary" />
          <p className="mt-4 text-xs text-sidebar-foreground/50">
            Authorised personnel only. All activity is recorded in the system audit trail.
          </p>
        </div>
        <p className="text-[11px] text-sidebar-foreground/40">
          {COMPANY.name} — Confidential
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <img
              src={COMPANY.logo}
              alt={COMPANY.name}
              className="mb-3 h-10 w-auto object-contain"
            />
            <p className="wordmark text-xl text-foreground">MURIVEST</p>
            <p className="mb-8 mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Internal System
            </p>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "sign_in" ? "Staff sign in" : "Register staff account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Use the credentials issued to you by management."
              : "The first account registered becomes the Managing Director. Later accounts require a role to be assigned before access is granted."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "register" ? (
              <>
                <Field label="Full name">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </Field>
                <Field label="Job title">
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Secretariat & Client Relations Officer"
                  />
                </Field>
              </>
            ) : null}
            <Field label="Work email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {mode === "sign_in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "sign_in" ? "register" : "sign_in")}
            className="mt-6 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "sign_in"
              ? "Register a new staff account"
              : "Back to sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
