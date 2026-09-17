import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export function useDesktopNotifications() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    // Request permission on first load
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [session]);

  const notify = (title: string, options?: NotificationOptions) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    }
  };

  return { notify };
}

export function useNotificationListener() {
  const { session, profile, can } = useAuth();

  useEffect(() => {
    if (!session || !profile) return;

    // Listen for new in-app notifications and show desktop notification
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            title: string;
            body: string | null;
            type: string;
          };

          // Check if user has desktop notifications enabled
          if (profile.desktop_notifications) {
            // Check specific notification type preferences
            const shouldNotify =
              (notification.type === "task_assigned" && profile.notify_task_assigned) ||
              (notification.type === "task_overdue" && profile.notify_task_deadline) ||
              (notification.type === "appointment_reminder" && profile.notify_appointment) ||
              (notification.type === "followup_due" && profile.notify_followup) ||
              (notification.type === "escalation_assigned" && profile.notify_escalation) ||
              (notification.type === "escalation_created" && profile.notify_escalation) ||
              (notification.type === "management_message" && profile.notify_management_message) ||
              (notification.type === "record_correction" && profile.notify_record_correction) ||
              (notification.type === "property_review_assigned" && profile.notify_property_review) ||
              (notification.type === "announcement" && profile.notify_announcement) ||
              (notification.type.startsWith("md_audit_") && profile.notify_all_crud);

            if (shouldNotify) {
              notify(notification.title, {
                body: notification.body || undefined,
                tag: payload.new.id,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, profile]);
}

// Need to import supabase
import { supabase } from "@/integrations/supabase/client";