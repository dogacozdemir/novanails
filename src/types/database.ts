export type AppointmentStatus =
  | "waiting"
  | "message_sent"
  | "confirmed"
  | "cancelled"
  | "completed";

export type ExpenseCategory =
  | "rent"
  | "staff"
  | "office"
  | "food"
  | "stationery"
  | "supplies"
  | "other";

/** Ödeme kanalı — appointments / revenue_entries ile uyumlu */
export type PaymentMethod = "cash" | "credit_card" | "iban";

/** Kullanıcı rolü — public.profiles.role */
export type UserRole = "admin" | "staff";

/** public.staff_time_off.type */
export type StaffTimeOffType = "holiday" | "leave";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          staff_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          staff_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          staff_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          surname: string;
          phone: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          surname: string;
          phone?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          surname?: string;
          phone?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          name: string;
          price: number | null;
          duration: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price?: number | null;
          duration?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price?: number | null;
          duration?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          name: string;
          color_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color_code: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_time_off: {
        Row: {
          id: string;
          staff_id: string;
          date: string;
          start_time: string;
          end_time: string;
          type: StaffTimeOffType;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          date: string;
          start_time: string;
          end_time: string;
          type: StaffTimeOffType;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          type?: StaffTimeOffType;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_time_off_staff_id_fkey";
            columns: ["staff_id"];
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          appointment_date: string;
          appointment_time: string;
          customer_id: string;
          service_id: string;
          staff_id: string;
          status: AppointmentStatus;
          notes: string | null;
          planned_duration: number;
          actual_duration: number | null;
          final_price: number | null;
          payment_method: PaymentMethod | null;
          staff_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_date: string;
          appointment_time: string;
          customer_id: string;
          service_id: string;
          staff_id: string;
          status?: AppointmentStatus;
          notes?: string | null;
          planned_duration?: number;
          actual_duration?: number | null;
          final_price?: number | null;
          payment_method?: PaymentMethod | null;
          staff_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          appointment_date?: string;
          appointment_time?: string;
          customer_id?: string;
          service_id?: string;
          staff_id?: string;
          status?: AppointmentStatus;
          notes?: string | null;
          planned_duration?: number;
          actual_duration?: number | null;
          final_price?: number | null;
          payment_method?: PaymentMethod | null;
          staff_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      revenue_entries: {
        Row: {
          id: string;
          appointment_id: string;
          amount: number;
          currency: string;
          recorded_at: string;
          note: string | null;
          payment_method: PaymentMethod | null;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          amount: number;
          currency?: string;
          recorded_at?: string;
          note?: string | null;
          payment_method?: PaymentMethod | null;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          amount?: number;
          currency?: string;
          recorded_at?: string;
          note?: string | null;
          payment_method?: PaymentMethod | null;
        };
        Relationships: [
          {
            foreignKeyName: "revenue_entries_appointment_id_fkey";
            columns: ["appointment_id"];
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          expense_date: string;
          category: ExpenseCategory;
          amount: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_date: string;
          category: ExpenseCategory;
          amount: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_date?: string;
          category?: ExpenseCategory;
          amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_corrections: {
        Row: {
          id: string;
          appointment_id: string;
          old_amount: number | null;
          new_amount: number;
          old_payment_method: PaymentMethod | null;
          new_payment_method: PaymentMethod;
          old_actual_duration: number | null;
          new_actual_duration: number | null;
          reason: string | null;
          corrected_by: string | null;
          corrected_by_email: string | null;
          created_at: string;
        };
        /** Yalnızca correct_appointment_payment() fonksiyonu yazar. */
        Insert: {
          id?: string;
          appointment_id: string;
          old_amount?: number | null;
          new_amount: number;
          old_payment_method?: PaymentMethod | null;
          new_payment_method: PaymentMethod;
          old_actual_duration?: number | null;
          new_actual_duration?: number | null;
          reason?: string | null;
          corrected_by?: string | null;
          corrected_by_email?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "payment_corrections_appointment_id_fkey";
            columns: ["appointment_id"];
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      correct_appointment_payment: {
        Args: {
          p_appointment_id: string;
          p_amount: number;
          p_payment_method: PaymentMethod;
          p_actual_duration?: number | null;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      appointment_status: AppointmentStatus;
      expense_category: ExpenseCategory;
      payment_method: PaymentMethod;
      user_role: UserRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
