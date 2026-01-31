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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_archive_files: {
        Row: {
          archived_at: string
          archived_by: string | null
          category: string | null
          client_id: string
          delivery_month: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          order_id: string | null
          order_number: string | null
          original_file_id: string | null
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          category?: string | null
          client_id: string
          delivery_month?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          original_file_id?: string | null
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          category?: string | null
          client_id?: string
          delivery_month?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          original_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_archive_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_archive_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_archive_files_original_file_id_fkey"
            columns: ["original_file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          brand_name: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          brand_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          brand_name?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          inclusions: string[] | null
          invoice_id: string
          order_id: string | null
          product_name: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          inclusions?: string[] | null
          invoice_id: string
          order_id?: string | null
          product_name: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          inclusions?: string[] | null
          invoice_id?: string
          order_id?: string | null
          product_name?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          accessories_cost: number
          accessories_detail: Json | null
          amount_paid: number
          client_id: string
          client_notes: string | null
          created_at: string
          created_by: string | null
          digital_printing_cost: number
          due_date: string | null
          embroidery_cost: number
          exchange_rate: number
          extra_fees: number
          fabric_cost: number
          id: string
          internal_notes: string | null
          invoice_number: string
          order_id: string | null
          order_name: string
          paid_at: string | null
          pattern_cost: number
          printing_cost: number
          production_cost: number
          profit_per_piece: number
          quantity: number
          retail_price: number
          sent_at: string | null
          setup_cost: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          terms_and_conditions: string | null
          total: number
          total_cost_per_piece: number
          updated_at: string
          viewed_at: string | null
          washing_cost: number
          wholesale_price: number
        }
        Insert: {
          accessories_cost?: number
          accessories_detail?: Json | null
          amount_paid?: number
          client_id: string
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          digital_printing_cost?: number
          due_date?: string | null
          embroidery_cost?: number
          exchange_rate?: number
          extra_fees?: number
          fabric_cost?: number
          id?: string
          internal_notes?: string | null
          invoice_number: string
          order_id?: string | null
          order_name: string
          paid_at?: string | null
          pattern_cost?: number
          printing_cost?: number
          production_cost?: number
          profit_per_piece?: number
          quantity?: number
          retail_price?: number
          sent_at?: string | null
          setup_cost?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms_and_conditions?: string | null
          total?: number
          total_cost_per_piece?: number
          updated_at?: string
          viewed_at?: string | null
          washing_cost?: number
          wholesale_price?: number
        }
        Update: {
          accessories_cost?: number
          accessories_detail?: Json | null
          amount_paid?: number
          client_id?: string
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          digital_printing_cost?: number
          due_date?: string | null
          embroidery_cost?: number
          exchange_rate?: number
          extra_fees?: number
          fabric_cost?: number
          id?: string
          internal_notes?: string | null
          invoice_number?: string
          order_id?: string | null
          order_name?: string
          paid_at?: string | null
          pattern_cost?: number
          printing_cost?: number
          production_cost?: number
          profit_per_piece?: number
          quantity?: number
          retail_price?: number
          sent_at?: string | null
          setup_cost?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms_and_conditions?: string | null
          total?: number
          total_cost_per_piece?: number
          updated_at?: string
          viewed_at?: string | null
          washing_cost?: number
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          brand_name: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number | null
          followers_range: string | null
          id: string
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          followers_range?: string | null
          id?: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number | null
          followers_range?: string | null
          id?: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          order_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          order_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          order_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_client_visible: boolean
          order_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_client_visible?: boolean
          order_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_client_visible?: boolean
          order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          is_client_visible: boolean
          order_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_client_visible?: boolean
          order_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_client_visible?: boolean
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["production_stage"] | null
          id: string
          notes: string | null
          order_id: string
          to_stage: Database["public"]["Enums"]["production_stage"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["production_stage"] | null
          id?: string
          notes?: string | null
          order_id: string
          to_stage: Database["public"]["Enums"]["production_stage"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["production_stage"] | null
          id?: string
          notes?: string | null
          order_id?: string
          to_stage?: Database["public"]["Enums"]["production_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "order_stage_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          order_id: string
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string
          collection: string | null
          created_at: string
          created_by: string | null
          current_stage: Database["public"]["Enums"]["production_stage"]
          delivery_date: string | null
          fabric: string | null
          has_embroidery: boolean
          has_printing: boolean
          has_wash_house: boolean
          id: string
          order_number: string
          pieces_sent: number | null
          priority: Database["public"]["Enums"]["order_priority"]
          product_name: string
          quantity: number
          size: string | null
          stage_updated_at: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          collection?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: Database["public"]["Enums"]["production_stage"]
          delivery_date?: string | null
          fabric?: string | null
          has_embroidery?: boolean
          has_printing?: boolean
          has_wash_house?: boolean
          id?: string
          order_number: string
          pieces_sent?: number | null
          priority?: Database["public"]["Enums"]["order_priority"]
          product_name: string
          quantity?: number
          size?: string | null
          stage_updated_at?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          collection?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: Database["public"]["Enums"]["production_stage"]
          delivery_date?: string | null
          fabric?: string | null
          has_embroidery?: boolean
          has_printing?: boolean
          has_wash_house?: boolean
          id?: string
          order_number?: string
          pieces_sent?: number | null
          priority?: Database["public"]["Enums"]["order_priority"]
          product_name?: string
          quantity?: number
          size?: string | null
          stage_updated_at?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["supplier_category"]
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          pricing_info: string | null
          quality_rating: number | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: Database["public"]["Enums"]["supplier_category"]
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          pricing_info?: string | null
          quality_rating?: number | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["supplier_category"]
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          pricing_info?: string | null
          quality_rating?: number | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_order_files: { Args: { _order_id: string }; Returns: boolean }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_to_client: { Args: { _client_id: string }; Returns: boolean }
      is_assigned_to_order: { Args: { _order_id: string }; Returns: boolean }
      is_assigned_to_profile: {
        Args: { _profile_user_id: string }
        Returns: boolean
      }
      is_client: { Args: never; Returns: boolean }
      is_client_of_order: { Args: { _order_id: string }; Returns: boolean }
      is_team: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "team" | "client"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partially_paid"
        | "paid"
        | "overdue"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      order_priority: "low" | "medium" | "high" | "urgent"
      production_stage:
        | "not_started"
        | "sample"
        | "cutting"
        | "printing"
        | "embroidery"
        | "sewing"
        | "wash_house"
        | "qc"
        | "packaging"
        | "shipping"
        | "delivered"
      supplier_category:
        | "fabric"
        | "printing"
        | "embroidery"
        | "sewing"
        | "packaging"
        | "wash_house"
        | "accessories"
        | "labels"
        | "other"
      task_status: "pending" | "in_progress" | "done" | "blocked"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "team", "client"],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "partially_paid",
        "paid",
        "overdue",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      order_priority: ["low", "medium", "high", "urgent"],
      production_stage: [
        "not_started",
        "sample",
        "cutting",
        "printing",
        "embroidery",
        "sewing",
        "wash_house",
        "qc",
        "packaging",
        "shipping",
        "delivered",
      ],
      supplier_category: [
        "fabric",
        "printing",
        "embroidery",
        "sewing",
        "packaging",
        "wash_house",
        "accessories",
        "labels",
        "other",
      ],
      task_status: ["pending", "in_progress", "done", "blocked"],
    },
  },
} as const
