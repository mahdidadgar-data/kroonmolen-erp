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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          city: string
          contact_email: string | null
          country: string
          created_at: string
          credit_limit: number
          customer_type: string
          id: string
          name: string
          payment_terms_days: number
        }
        Insert: {
          city: string
          contact_email?: string | null
          country: string
          created_at?: string
          credit_limit?: number
          customer_type: string
          id: string
          name: string
          payment_terms_days?: number
        }
        Update: {
          city?: string
          contact_email?: string | null
          country?: string
          created_at?: string
          credit_limit?: number
          customer_type?: string
          id?: string
          name?: string
          payment_terms_days?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          product_sku: string
          quantity_tonnes: number
          reorder_level_tonnes: number
          stock_status: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          product_sku: string
          quantity_tonnes?: number
          reorder_level_tonnes?: number
          stock_status?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          product_sku?: string
          quantity_tonnes?: number
          reorder_level_tonnes?: number
          stock_status?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_sku_fkey"
            columns: ["product_sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_excl_vat: number
          amount_incl_vat: number
          created_at: string
          customer_id: string
          due_date: string
          id: string
          invoice_date: string
          order_id: string
          paid_date: string | null
          status: string
          vat_rate: number
        }
        Insert: {
          amount_excl_vat: number
          amount_incl_vat: number
          created_at?: string
          customer_id: string
          due_date: string
          id: string
          invoice_date: string
          order_id: string
          paid_date?: string | null
          status?: string
          vat_rate: number
        }
        Update: {
          amount_excl_vat?: number
          amount_incl_vat?: number
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          invoice_date?: string
          order_id?: string
          paid_date?: string | null
          status?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_activity: {
        Row: {
          actor: string
          created_at: string
          event: string
          from_status: string | null
          id: number
          order_id: string
          to_status: string | null
        }
        Insert: {
          actor?: string
          created_at?: string
          event: string
          from_status?: string | null
          id?: never
          order_id: string
          to_status?: string | null
        }
        Update: {
          actor?: string
          created_at?: string
          event?: string
          from_status?: string | null
          id?: never
          order_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          form: string
          name: string
          packaging: string
          sku: string
          species: string
          unit_price_per_tonne: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          form: string
          name: string
          packaging: string
          sku: string
          species: string
          unit_price_per_tonne: number
        }
        Update: {
          active?: boolean
          created_at?: string
          form?: string
          name?: string
          packaging?: string
          sku?: string
          species?: string
          unit_price_per_tonne?: number
        }
        Relationships: []
      }
      sales_order_lines: {
        Row: {
          id: string
          line_no: number
          line_total: number | null
          order_id: string
          product_sku: string
          quantity_tonnes: number
          unit_price: number
        }
        Insert: {
          id: string
          line_no: number
          line_total?: number | null
          order_id: string
          product_sku: string
          quantity_tonnes: number
          unit_price: number
        }
        Update: {
          id?: string
          line_no?: number
          line_total?: number | null
          order_id?: string
          product_sku?: string
          quantity_tonnes?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_product_sku_fkey"
            columns: ["product_sku"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["sku"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          order_date: string
          requested_delivery_date: string
          status: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id: string
          notes?: string | null
          order_date: string
          requested_delivery_date: string
          status?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          requested_delivery_date?: string
          status?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          actual_date: string | null
          carrier: string
          created_at: string
          delay_reason: string | null
          id: string
          order_id: string
          planned_date: string
          quantity_tonnes: number
          status: string
        }
        Insert: {
          actual_date?: string | null
          carrier: string
          created_at?: string
          delay_reason?: string | null
          id: string
          order_id: string
          planned_date: string
          quantity_tonnes: number
          status?: string
        }
        Update: {
          actual_date?: string | null
          carrier?: string
          created_at?: string
          delay_reason?: string | null
          id?: string
          order_id?: string
          planned_date?: string
          quantity_tonnes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          city: string
          country: string
          id: string
          name: string
        }
        Insert: {
          city: string
          country: string
          id: string
          name: string
        }
        Update: {
          city?: string
          country?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
