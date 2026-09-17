export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          attendee_id: string | null
          checklist: Json | null
          client_name: string
          confirmation_message: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_minutes: number
          email: string | null
          format: Database["public"]["Enums"]["appointment_format"]
          id: string
          inquiry_id: string | null
          location: string | null
          notes: string | null
          outcome: string | null
          phone: string | null
          purpose: string | null
          reminder_message: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          attendee_id?: string | null
          checklist?: Json | null
          client_name: string
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_minutes?: number
          email?: string | null
          format?: Database["public"]["Enums"]["appointment_format"]
          id?: string
          inquiry_id?: string | null
          location?: string | null
          notes?: string | null
          outcome?: string | null
          phone?: string | null
          purpose?: string | null
          reminder_message?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          attendee_id?: string | null
          checklist?: Json | null
          client_name?: string
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_minutes?: number
          email?: string | null
          format?: Database["public"]["Enums"]["appointment_format"]
          id?: string
          inquiry_id?: string | null
          location?: string | null
          notes?: string | null
          outcome?: string | null
          phone?: string | null
          purpose?: string | null
          reminder_message?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          field: string | null
          id: string
          module: string
          new_value: string | null
          previous_value: string | null
          record_id: string | null
          record_label: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field?: string | null
          id?: string
          module: string
          new_value?: string | null
          previous_value?: string | null
          record_id?: string | null
          record_label?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field?: string | null
          id?: string
          module?: string
          new_value?: string | null
          previous_value?: string | null
          record_id?: string | null
          record_label?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      call_scripts: {
        Row: {
          body: string
          category: string
          created_at: string
          guidance: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          guidance?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          guidance?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          action_taken: string | null
          assigned_to: string | null
          caller_name: string
          category: Database["public"]["Enums"]["call_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          escalation: Database["public"]["Enums"]["escalation_level"]
          followup_date: string | null
          followup_required: boolean
          id: string
          notes: string | null
          occurred_at: string
          phone: string | null
          property_id: string | null
          reason: string | null
          source: Database["public"]["Enums"]["inquiry_source"] | null
          status: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          assigned_to?: string | null
          caller_name: string
          category?: Database["public"]["Enums"]["call_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          escalation?: Database["public"]["Enums"]["escalation_level"]
          followup_date?: string | null
          followup_required?: boolean
          id?: string
          notes?: string | null
          occurred_at?: string
          phone?: string | null
          property_id?: string | null
          reason?: string | null
          source?: Database["public"]["Enums"]["inquiry_source"] | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          assigned_to?: string | null
          caller_name?: string
          category?: Database["public"]["Enums"]["call_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          escalation?: Database["public"]["Enums"]["escalation_level"]
          followup_date?: string | null
          followup_required?: boolean
          id?: string
          notes?: string | null
          occurred_at?: string
          phone?: string | null
          property_id?: string | null
          reason?: string | null
          source?: Database["public"]["Enums"]["inquiry_source"] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["contact_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          organization: string | null
          phone: string | null
          role: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["contact_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["contact_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      correspondence: {
        Row: {
          action_required: boolean
          assigned_to: string | null
          attachment_url: string | null
          channel: string
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          due_date: string | null
          from_to: string
          id: string
          notes: string | null
          related_inquiry_id: string | null
          related_property_id: string | null
          related_task_id: string | null
          status: string
          subject: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_required?: boolean
          assigned_to?: string | null
          attachment_url?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          due_date?: string | null
          from_to: string
          id?: string
          notes?: string | null
          related_inquiry_id?: string | null
          related_property_id?: string | null
          related_task_id?: string | null
          status?: string
          subject?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_required?: boolean
          assigned_to?: string | null
          attachment_url?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          due_date?: string | null
          from_to?: string
          id?: string
          notes?: string | null
          related_inquiry_id?: string | null
          related_property_id?: string | null
          related_task_id?: string | null
          status?: string
          subject?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          created_at: string
          created_by: string | null
          developments: string | null
          id: string
          md_attention: string | null
          metrics: Json
          priorities_tomorrow: string | null
          report_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          developments?: string | null
          id?: string
          md_attention?: string | null
          metrics?: Json
          priorities_tomorrow?: string | null
          report_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          developments?: string | null
          id?: string
          md_attention?: string | null
          metrics?: Json
          priorities_tomorrow?: string | null
          report_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          body: string | null
          created_at: string
          id: string
          module: string | null
          recipient_id: string
          record_id: string | null
          sent_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          module?: string | null
          recipient_id: string
          record_id?: string | null
          sent_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          module?: string | null
          recipient_id?: string
          record_id?: string | null
          sent_at?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      escalations: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          management_response: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          reason: string
          related_module: string
          related_record_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          management_response?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          reason: string
          related_module: string
          related_record_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          management_response?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          reason?: string
          related_module?: string
          related_record_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      followups: {
        Row: {
          assigned_to: string | null
          client_name: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string
          id: string
          inquiry_id: string | null
          last_contact: string | null
          notes: string | null
          pending_action: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["followup_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_name: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date: string
          id?: string
          inquiry_id?: string | null
          last_contact?: string | null
          notes?: string | null
          pending_action: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["followup_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string
          id?: string
          inquiry_id?: string | null
          last_contact?: string | null
          notes?: string | null
          pending_action?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["followup_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["inquiry_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          escalation: Database["public"]["Enums"]["escalation_level"]
          id: string
          inquiry_type: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          property_id: string | null
          prospect_name: string
          received_at: string
          service_interest: string | null
          source: Database["public"]["Enums"]["inquiry_source"]
          status: Database["public"]["Enums"]["inquiry_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["inquiry_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          escalation?: Database["public"]["Enums"]["escalation_level"]
          id?: string
          inquiry_type?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          prospect_name: string
          received_at?: string
          service_interest?: string | null
          source?: Database["public"]["Enums"]["inquiry_source"]
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["inquiry_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          escalation?: Database["public"]["Enums"]["escalation_level"]
          id?: string
          inquiry_type?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          property_id?: string | null
          prospect_name?: string
          received_at?: string
          service_interest?: string | null
          source?: Database["public"]["Enums"]["inquiry_source"]
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_guide: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          module: string | null
          read_at: string | null
          recipient_id: string
          record_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          module?: string | null
          read_at?: string | null
          recipient_id: string
          record_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          module?: string | null
          read_at?: string | null
          recipient_id?: string
          record_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          desktop_notifications: boolean
          email: string
          email_notifications: boolean
          full_name: string
          id: string
          in_app_notifications: boolean
          job_title: string
          notify_all_crud: boolean
          notify_announcement: boolean
          notify_appointment: boolean
          notify_escalation: boolean
          notify_followup: boolean
          notify_management_message: boolean
          notify_property_review: boolean
          notify_record_correction: boolean
          notify_task_assigned: boolean
          notify_task_deadline: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          desktop_notifications?: boolean
          email?: string
          email_notifications?: boolean
          full_name?: string
          id: string
          in_app_notifications?: boolean
          job_title?: string
          notify_all_crud?: boolean
          notify_announcement?: boolean
          notify_appointment?: boolean
          notify_escalation?: boolean
          notify_followup?: boolean
          notify_management_message?: boolean
          notify_property_review?: boolean
          notify_record_correction?: boolean
          notify_task_assigned?: boolean
          notify_task_deadline?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          desktop_notifications?: boolean
          email?: string
          email_notifications?: boolean
          full_name?: string
          id?: string
          in_app_notifications?: boolean
          job_title?: string
          notify_all_crud?: boolean
          notify_announcement?: boolean
          notify_appointment?: boolean
          notify_escalation?: boolean
          notify_followup?: boolean
          notify_management_message?: boolean
          notify_property_review?: boolean
          notify_record_correction?: boolean
          notify_task_assigned?: boolean
          notify_task_deadline?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          annual_income: number | null
          approved_at: string | null
          approved_by: string | null
          asset_characteristics: string | null
          building_size: string | null
          city: string | null
          county: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          income_information: string | null
          internal_notes: string | null
          internal_valuation: string | null
          investment_highlights: string | null
          investment_summary: string | null
          land_size: string | null
          location: string | null
          location_advantages: string | null
          monthly_income: number | null
          name: string
          occupancy: number | null
          price: number | null
          price_currency: string | null
          primary_image_url: string | null
          property_type: string | null
          published_at: string | null
          reference: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_information: string | null
          status: Database["public"]["Enums"]["property_status"]
          tenure: string | null
          units: number | null
          updated_at: string
          updated_by: string | null
          yield_percent: number | null
        }
        Insert: {
          address?: string | null
          annual_income?: number | null
          approved_at?: string | null
          approved_by?: string | null
          asset_characteristics?: string | null
          building_size?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          income_information?: string | null
          internal_notes?: string | null
          internal_valuation?: string | null
          investment_highlights?: string | null
          investment_summary?: string | null
          land_size?: string | null
          location?: string | null
          location_advantages?: string | null
          monthly_income?: number | null
          name: string
          occupancy?: number | null
          price?: number | null
          price_currency?: string | null
          primary_image_url?: string | null
          property_type?: string | null
          published_at?: string | null
          reference?: string | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_information?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          tenure?: string | null
          units?: number | null
          updated_at?: string
          updated_by?: string | null
          yield_percent?: number | null
        }
        Update: {
          address?: string | null
          annual_income?: number | null
          approved_at?: string | null
          approved_by?: string | null
          asset_characteristics?: string | null
          building_size?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          income_information?: string | null
          internal_notes?: string | null
          internal_valuation?: string | null
          investment_highlights?: string | null
          investment_summary?: string | null
          land_size?: string | null
          location?: string | null
          location_advantages?: string | null
          monthly_income?: number | null
          name?: string
          occupancy?: number | null
          price?: number | null
          price_currency?: string | null
          primary_image_url?: string | null
          property_type?: string | null
          published_at?: string | null
          reference?: string | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_information?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          tenure?: string | null
          units?: number | null
          updated_at?: string
          updated_by?: string | null
          yield_percent?: number | null
        }
        Relationships: []
      }
      property_images: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          id: string
          property_id: string
          sort_order: number
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          property_id: string
          sort_order?: number
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          property_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          property_id: string
          reviewed_by: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          property_id: string
          reviewed_by: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          property_id?: string
          reviewed_by?: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "property_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card: {
        Row: {
          bonus_condition: string | null
          bonus_kes: number
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          rate_kes: number
          requires_master_db: boolean
          section: string
          sort_order: number
          total_possible_kes: number
          tracks_property: boolean
          unit_label: string
          updated_at: string
        }
        Insert: {
          bonus_condition?: string | null
          bonus_kes?: number
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          rate_kes?: number
          requires_master_db?: boolean
          section?: string
          sort_order?: number
          tracks_property?: boolean
          unit_label?: string
          updated_at?: string
        }
        Update: {
          bonus_condition?: string | null
          bonus_kes?: number
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          rate_kes?: number
          requires_master_db?: boolean
          section?: string
          sort_order?: number
          tracks_property?: boolean
          unit_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          related_appointment_id: string | null
          related_client: string | null
          related_deal_id: string | null
          related_inquiry_id: string | null
          related_property_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          related_appointment_id?: string | null
          related_client?: string | null
          related_deal_id?: string | null
          related_inquiry_id?: string | null
          related_property_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          related_appointment_id?: string | null
          related_client?: string | null
          related_deal_id?: string | null
          related_inquiry_id?: string | null
          related_property_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_payments: {
        Row: {
          amount_kes: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string
          period_end: string | null
          period_start: string | null
          reference: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_log_entries: {
        Row: {
          amount_kes: number
          approved_at: string | null
          approved_by: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entry_date: string
          id: string
          master_db_status: string
          notes: string | null
          payment_id: string | null
          platform: string | null
          property_type: string | null
          quantity: number
          rate_card_id: string
          reference_url: string | null
          rejection_reason: string | null
          related_property_id: string | null
          staff_id: string
          status: string
          unit_bonus_kes: number
          unit_rate_kes: number
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          master_db_status?: string
          notes?: string | null
          payment_id?: string | null
          platform?: string | null
          property_type?: string | null
          quantity?: number
          rate_card_id: string
          reference_url?: string | null
          rejection_reason?: string | null
          related_property_id?: string | null
          staff_id: string
          status?: string
          unit_bonus_kes?: number
          unit_rate_kes?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          master_db_status?: string
          notes?: string | null
          payment_id?: string | null
          platform?: string | null
          property_type?: string | null
          quantity?: number
          rate_card_id?: string
          reference_url?: string | null
          rejection_reason?: string | null
          related_property_id?: string | null
          staff_id?: string
          status?: string
          unit_bonus_kes?: number
          unit_rate_kes?: number
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_log_entries_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_log_entries_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_log_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "wallet_payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      staff_wallet_summary: {
        Row: {
          approved_kes: number
          balance_kes: number
          earned_kes: number
          email: string | null
          entry_count: number
          full_name: string | null
          job_title: string | null
          last_entry_date: string | null
          paid_kes: number
          pending_kes: number
          rejected_kes: number
          staff_id: string
          unit_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      can: { Args: { _permission: string }; Returns: boolean }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "managing_director" | "secretariat" | "capital_advisor"
      appointment_format:
        | "physical_meeting"
        | "virtual_meeting"
        | "site_visit"
        | "office_meeting"
        | "phone_call"
        | "other"
      appointment_status:
        | "requested"
        | "pending_confirmation"
        | "confirmed"
        | "rescheduled"
        | "completed"
        | "cancelled"
        | "no_show"
      call_category:
        | "buyer"
        | "investor"
        | "owner_seller"
        | "tenant"
        | "vendor"
        | "partner"
        | "general"
        | "wrong_number"
        | "spam"
        | "existing_client"
      contact_category:
        | "client"
        | "investor"
        | "owner"
        | "broker"
        | "lawyer"
        | "bank"
        | "supplier"
        | "partner"
        | "advisor"
        | "corporate"
        | "other"
      escalation_level:
        | "none"
        | "requires_md"
        | "requires_capital_advisor"
        | "requires_property_review"
        | "requires_management_decision"
        | "urgent"
      followup_status: "pending" | "completed" | "cancelled"
      inquiry_category:
        | "buyer"
        | "investor"
        | "owner_seller"
        | "tenant"
        | "landlord"
        | "vendor"
        | "partner"
        | "general"
      inquiry_source:
        | "website"
        | "jiji"
        | "whatsapp"
        | "phone"
        | "referral"
        | "email"
        | "walk_in"
        | "other"
      inquiry_status:
        | "new"
        | "contacted"
        | "qualification_pending"
        | "appointment_requested"
        | "appointment_confirmed"
        | "meeting_completed"
        | "handed_over"
        | "follow_up"
        | "converted"
        | "nurture"
        | "closed"
      priority_level: "low" | "normal" | "high" | "urgent"
      property_status:
        | "draft"
        | "internal_review"
        | "approved"
        | "published"
        | "needs_update"
        | "archived"
      review_status: "verified" | "needs_correction" | "awaiting_information"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["managing_director", "secretariat", "capital_advisor"],
      appointment_format: [
        "physical_meeting",
        "virtual_meeting",
        "site_visit",
        "office_meeting",
        "phone_call",
        "other",
      ],
      appointment_status: [
        "requested",
        "pending_confirmation",
        "confirmed",
        "rescheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      call_category: [
        "buyer",
        "investor",
        "owner_seller",
        "tenant",
        "vendor",
        "partner",
        "general",
        "wrong_number",
        "spam",
        "existing_client",
      ],
      contact_category: [
        "client",
        "investor",
        "owner",
        "broker",
        "lawyer",
        "bank",
        "supplier",
        "partner",
        "advisor",
        "corporate",
        "other",
      ],
      escalation_level: [
        "none",
        "requires_md",
        "requires_capital_advisor",
        "requires_property_review",
        "requires_management_decision",
        "urgent",
      ],
      followup_status: ["pending", "completed", "cancelled"],
      inquiry_category: [
        "buyer",
        "investor",
        "owner_seller",
        "tenant",
        "landlord",
        "vendor",
        "partner",
        "general",
      ],
      inquiry_source: [
        "website",
        "jiji",
        "whatsapp",
        "phone",
        "referral",
        "email",
        "walk_in",
        "other",
      ],
      inquiry_status: [
        "new",
        "contacted",
        "qualification_pending",
        "appointment_requested",
        "appointment_confirmed",
        "meeting_completed",
        "handed_over",
        "follow_up",
        "converted",
        "nurture",
        "closed",
      ],
      priority_level: ["low", "normal", "high", "urgent"],
      property_status: [
        "draft",
        "internal_review",
        "approved",
        "published",
        "needs_update",
        "archived",
      ],
      review_status: ["verified", "needs_correction", "awaiting_information"],
    },
  },
} as const
