import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Contact,
  FileText,
  Flag,
  Gauge,
  LogOut,
  Menu,
  MessageSquareQuote,
  PhoneCall,
  ScrollText,
  Settings,
  ShieldCheck,
  Timer,
  Users,
  X,
  Mail,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMPANY, ROLE_LABEL } from "@/lib/constants";
import { formatDateTime, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationListener } from "@/hooks/use-desktop-notifications";

type NavItem = { to: string; label: string; icon: typeof Gauge; permission?: string };
type NavGroup = { heading: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ to: "/app/dashboard", label: "Dashboard", icon: Gauge, permission: "dashboard.view" }],
  },
  {
    heading: "Client & Secretariat",
    items: [
      { to: "/app/inquiries", label: "Inquiries", icon: ClipboardList, permission: "inquiries.view" },
      { to: "/app/calls", label: "Calls", icon: PhoneCall, permission: "calls.view" },
      { to: "/app/appointments", label: "Appointments", icon: CalendarDays, permission: "appointments.view" },
      { to: "/app/followups", label: "Follow-ups", icon: Timer, permission: "followups.view" },
      { to: "/app/contacts", label: "Contacts", icon: Contact, permission: "contacts.view" },
      { to: "/app/scripts", label: "Call Scripts", icon: MessageSquareQuote, permission: "scripts.view" },
      { to: "/app/correspondence", label: "Correspondence", icon: Mail, permission: "correspondence.view" },
    ],
  },
  {
    heading: "Tasks & Workflow",
    items: [
      { to: "/app/tasks", label: "Tasks", icon: Flag, permission: "tasks.view" },
      { to: "/app/escalations", label: "Escalations", icon: AlertTriangle, permission: "escalations.view" },
    ],
  },
  {
    heading: "Properties",
    items: [
      { to: "/app/properties", label: "All Properties", icon: Building2, permission: "properties.view" },
      { to: "/app/work-log", label: "Work Log", icon: ClipboardCheck, permission: "worklog.view" },
    ],
  },
  {
    heading: "Earnings",
    items: [{ to: "/app/wallet", label: "My Wallet", icon: Wallet, permission: "wallet.view" }],
  },
  {
    heading: "Knowledge",
    items: [
      { to: "/app/knowledge", label: "Knowledge Guide", icon: BookOpen, permission: "knowledge.view" },
    ],
  },
  {
    heading: "Reports",
    items: [{ to: "/app/reports", label: "Daily Reports", icon: FileText, permission: "reports.view" }],
  },
  {
    heading: "System",
    items: [
      { to: "/app/notifications", label: "Notifications", icon: Bell },
      { to: "/app/audit-log", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
      { to: "/app/users", label: "Users", icon: Users, permission: "users.view" },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NotificationBell() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications", "recent"],
    enabled: !!session,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });
  const unread = data.filter((n) => !n.read_at).length;

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 inline-flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-gold-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <ScrollArea className="max-h-80">
          {data.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((n) => (
                <li key={n.id} className={cn("px-3 py-2.5", !n.read_at && "bg-accent/50")}>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body ? (
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // Enable desktop notifications for relevant events
  useNotificationListener();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/login", replace: true });
  }

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <img
              src={COMPANY.logo}
              alt=""
              aria-hidden="true"
              className="size-8 shrink-0 rounded-sm object-contain"
            />
            <div>
              <p className="wordmark text-base text-sidebar-primary">MURIVEST</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Internal System
              </p>
            </div>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.to || pathname.startsWith(`${item.to}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="text-[10px] leading-relaxed text-sidebar-foreground/50">
            {COMPANY.name}
            <br />
            {COMPANY.subtitle}
          </p>
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-primary/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{COMPANY.system}</p>
              <p className="text-[11px] text-muted-foreground">{COMPANY.subtitle}</p>
            </div>
            <img
              src={COMPANY.logo}
              alt={COMPANY.name}
              className="size-7 rounded-sm object-contain sm:hidden"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-sm border border-border px-2 py-1.5 text-left transition-colors hover:bg-accent">
                  <span className="flex size-7 items-center justify-center rounded-sm bg-primary text-[11px] font-semibold text-primary-foreground">
                    {initials(profile?.full_name || profile?.email || "?")}
                  </span>
                  <span className="hidden leading-tight sm:block">
                    <span className="block text-xs font-medium text-foreground">
                      {profile?.full_name || profile?.email}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {role ? ROLE_LABEL[role] : "No role assigned"}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/settings">
                    <Settings className="mr-2 size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                {can("audit.view") ? (
                  <DropdownMenuItem asChild>
                    <Link to="/app/audit-log">
                      <ShieldCheck className="mr-2 size-4" /> Audit log
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
