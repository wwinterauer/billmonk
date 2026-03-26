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
      admin_activity_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string | null
          bank_name: string | null
          created_at: string | null
          iban: string | null
          id: string
          is_default: boolean | null
          user_id: string
        }
        Insert: {
          account_name?: string | null
          bank_name?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          user_id: string
        }
        Update: {
          account_name?: string | null
          bank_name?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections_live: {
        Row: {
          account_id: string | null
          created_at: string | null
          iban: string | null
          id: string
          institution_id: string | null
          institution_logo: string | null
          institution_name: string | null
          last_sync_at: string | null
          provider: string
          requisition_id: string | null
          status: string
          sync_error: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          institution_id?: string | null
          institution_logo?: string | null
          institution_name?: string | null
          last_sync_at?: string | null
          provider?: string
          requisition_id?: string | null
          status?: string
          sync_error?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          iban?: string | null
          id?: string
          institution_id?: string | null
          institution_logo?: string | null
          institution_name?: string | null
          last_sync_at?: string | null
          provider?: string
          requisition_id?: string | null
          status?: string
          sync_error?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_live_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_import_keywords: {
        Row: {
          category: string | null
          created_at: string | null
          description_template: string | null
          id: string
          is_active: boolean | null
          keyword: string
          tax_rate: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description_template?: string | null
          id?: string
          is_active?: boolean | null
          keyword: string
          tax_rate?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description_template?: string | null
          id?: string
          is_active?: boolean | null
          keyword?: string
          tax_rate?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_imports: {
        Row: {
          bank_account_id: string | null
          created_at: string | null
          date_from: string | null
          date_to: string | null
          file_name: string | null
          id: string
          imported_rows: number | null
          skipped_rows: number | null
          total_rows: number | null
          user_id: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string | null
          date_from?: string | null
          date_to?: string | null
          file_name?: string | null
          id?: string
          imported_rows?: number | null
          skipped_rows?: number | null
          total_rows?: number | null
          user_id: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string | null
          date_from?: string | null
          date_to?: string | null
          file_name?: string | null
          id?: string
          imported_rows?: number | null
          skipped_rows?: number | null
          total_rows?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_imports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number | null
          bank_account_id: string | null
          created_at: string | null
          description: string | null
          external_id: string | null
          id: string
          import_batch_id: string | null
          invoice_id: string | null
          is_expense: boolean | null
          raw_data: Json | null
          receipt_id: string | null
          source: string
          status: string | null
          transaction_date: string | null
          user_id: string
          value_date: string | null
        }
        Insert: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          import_batch_id?: string | null
          invoice_id?: string | null
          is_expense?: boolean | null
          raw_data?: Json | null
          receipt_id?: string | null
          source?: string
          status?: string | null
          transaction_date?: string | null
          user_id: string
          value_date?: string | null
        }
        Update: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          import_batch_id?: string | null
          invoice_id?: string | null
          is_expense?: boolean | null
          raw_data?: Json | null
          receipt_id?: string | null
          source?: string
          status?: string | null
          transaction_date?: string | null
          user_id?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "bank_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bank_transactions_receipt"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_senders: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          sender_email: string
          sender_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          sender_email: string
          sender_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          sender_email?: string
          sender_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_hidden: boolean | null
          is_system: boolean | null
          name: string
          sort_order: number | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean | null
          is_system?: boolean | null
          name: string
          sort_order?: number | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean | null
          is_system?: boolean | null
          name?: string
          sort_order?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          links: Json | null
          name: string
          notes: string | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          links?: Json | null
          name: string
          notes?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          links?: Json | null
          name?: string
          notes?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cloud_connections: {
        Row: {
          access_token: string | null
          backup_day_of_month: number | null
          backup_enabled: boolean | null
          backup_file_prefix: string | null
          backup_folder_id: string | null
          backup_folder_path: string | null
          backup_folder_structure: string | null
          backup_include_csv: boolean | null
          backup_include_excel: boolean | null
          backup_include_files: boolean | null
          backup_include_invoices: boolean | null
          backup_schedule_type: string | null
          backup_status_filter: string[] | null
          backup_template_id: string | null
          backup_time: string | null
          backup_weekday: number | null
          backup_zip_pattern: string | null
          created_at: string | null
          display_name: string | null
          folder_path: string | null
          id: string
          is_active: boolean | null
          last_backup_at: string | null
          last_backup_count: number | null
          last_backup_error: string | null
          last_sync: string | null
          next_backup_at: string | null
          oauth_access_token: string | null
          oauth_refresh_token: string | null
          oauth_token_expires_at: string | null
          provider: string | null
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          backup_day_of_month?: number | null
          backup_enabled?: boolean | null
          backup_file_prefix?: string | null
          backup_folder_id?: string | null
          backup_folder_path?: string | null
          backup_folder_structure?: string | null
          backup_include_csv?: boolean | null
          backup_include_excel?: boolean | null
          backup_include_files?: boolean | null
          backup_include_invoices?: boolean | null
          backup_schedule_type?: string | null
          backup_status_filter?: string[] | null
          backup_template_id?: string | null
          backup_time?: string | null
          backup_weekday?: number | null
          backup_zip_pattern?: string | null
          created_at?: string | null
          display_name?: string | null
          folder_path?: string | null
          id?: string
          is_active?: boolean | null
          last_backup_at?: string | null
          last_backup_count?: number | null
          last_backup_error?: string | null
          last_sync?: string | null
          next_backup_at?: string | null
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires_at?: string | null
          provider?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          backup_day_of_month?: number | null
          backup_enabled?: boolean | null
          backup_file_prefix?: string | null
          backup_folder_id?: string | null
          backup_folder_path?: string | null
          backup_folder_structure?: string | null
          backup_include_csv?: boolean | null
          backup_include_excel?: boolean | null
          backup_include_files?: boolean | null
          backup_include_invoices?: boolean | null
          backup_schedule_type?: string | null
          backup_status_filter?: string[] | null
          backup_template_id?: string | null
          backup_time?: string | null
          backup_weekday?: number | null
          backup_zip_pattern?: string | null
          created_at?: string | null
          display_name?: string | null
          folder_path?: string | null
          id?: string
          is_active?: boolean | null
          last_backup_at?: string | null
          last_backup_count?: number | null
          last_backup_error?: string | null
          last_sync?: string | null
          next_backup_at?: string | null
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires_at?: string | null
          provider?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_connections_backup_template_id_fkey"
            columns: ["backup_template_id"]
            isOneToOne: false
            referencedRelation: "export_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cloud_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          account_holder: string | null
          bank_name: string | null
          bic: string | null
          city: string | null
          company_name: string | null
          company_register_court: string | null
          company_register_number: string | null
          country: string | null
          created_at: string | null
          email: string | null
          iban: string | null
          id: string
          is_small_business: boolean | null
          logo_path: string | null
          phone: string | null
          small_business_text: string | null
          street: string | null
          uid_number: string | null
          updated_at: string | null
          user_id: string
          zip: string | null
        }
        Insert: {
          account_holder?: string | null
          bank_name?: string | null
          bic?: string | null
          city?: string | null
          company_name?: string | null
          company_register_court?: string | null
          company_register_number?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          is_small_business?: boolean | null
          logo_path?: string | null
          phone?: string | null
          small_business_text?: string | null
          street?: string | null
          uid_number?: string | null
          updated_at?: string | null
          user_id: string
          zip?: string | null
        }
        Update: {
          account_holder?: string | null
          bank_name?: string | null
          bic?: string | null
          city?: string | null
          company_name?: string | null
          company_register_court?: string | null
          company_register_number?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          is_small_business?: boolean | null
          logo_path?: string | null
          phone?: string | null
          small_business_text?: string | null
          street?: string | null
          uid_number?: string | null
          updated_at?: string | null
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          customer_number: string | null
          default_currency: string | null
          default_discount_percent: number | null
          default_skonto_days: number | null
          default_skonto_percent: number | null
          display_name: string
          email: string | null
          has_different_shipping_address: boolean | null
          id: string
          is_archived: boolean | null
          notes: string | null
          payment_terms_days: number | null
          phone: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_street: string | null
          shipping_zip: string | null
          street: string | null
          uid_number: string | null
          updated_at: string | null
          user_id: string
          zip: string | null
        }
        Insert: {
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          customer_number?: string | null
          default_currency?: string | null
          default_discount_percent?: number | null
          default_skonto_days?: number | null
          default_skonto_percent?: number | null
          display_name: string
          email?: string | null
          has_different_shipping_address?: boolean | null
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_street?: string | null
          shipping_zip?: string | null
          street?: string | null
          uid_number?: string | null
          updated_at?: string | null
          user_id: string
          zip?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          customer_number?: string | null
          default_currency?: string | null
          default_discount_percent?: number | null
          default_skonto_days?: number | null
          default_skonto_percent?: number | null
          display_name?: string
          email?: string | null
          has_different_shipping_address?: boolean | null
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_street?: string | null
          shipping_zip?: string | null
          street?: string | null
          uid_number?: string | null
          updated_at?: string | null
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          created_at: string | null
          display_name: string | null
          email_address: string
          id: string
          imap_host: string
          imap_password_encrypted: string
          imap_port: number
          imap_use_ssl: boolean | null
          imap_username: string
          inbox_folder: string | null
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_attempt: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_synced_uid: string | null
          oauth_access_token: string | null
          oauth_provider: string | null
          oauth_refresh_token: string | null
          oauth_scope: string | null
          oauth_token_expires_at: string | null
          processed_folder: string | null
          provider: string | null
          sender_filter: string[] | null
          subject_keywords: string[] | null
          sync_interval: string
          total_imported: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email_address: string
          id?: string
          imap_host: string
          imap_password_encrypted: string
          imap_port?: number
          imap_use_ssl?: boolean | null
          imap_username: string
          inbox_folder?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_attempt?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_uid?: string | null
          oauth_access_token?: string | null
          oauth_provider?: string | null
          oauth_refresh_token?: string | null
          oauth_scope?: string | null
          oauth_token_expires_at?: string | null
          processed_folder?: string | null
          provider?: string | null
          sender_filter?: string[] | null
          subject_keywords?: string[] | null
          sync_interval?: string
          total_imported?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email_address?: string
          id?: string
          imap_host?: string
          imap_password_encrypted?: string
          imap_port?: number
          imap_use_ssl?: boolean | null
          imap_username?: string
          inbox_folder?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_attempt?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_synced_uid?: string | null
          oauth_access_token?: string | null
          oauth_provider?: string | null
          oauth_refresh_token?: string | null
          oauth_scope?: string | null
          oauth_token_expires_at?: string | null
          processed_folder?: string | null
          provider?: string | null
          sender_filter?: string[] | null
          subject_keywords?: string[] | null
          sync_interval?: string
          total_imported?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          attachment_content_type: string | null
          attachment_filename: string
          attachment_size: number | null
          created_at: string | null
          duplicate_of: string | null
          email_account_id: string | null
          email_connection_id: string | null
          email_from: string | null
          email_import_id: string | null
          email_message_id: string | null
          email_received_at: string | null
          email_subject: string | null
          error_message: string | null
          file_hash: string | null
          id: string
          is_duplicate: boolean | null
          processed_at: string | null
          receipt_id: string | null
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          attachment_content_type?: string | null
          attachment_filename: string
          attachment_size?: number | null
          created_at?: string | null
          duplicate_of?: string | null
          email_account_id?: string | null
          email_connection_id?: string | null
          email_from?: string | null
          email_import_id?: string | null
          email_message_id?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          error_message?: string | null
          file_hash?: string | null
          id?: string
          is_duplicate?: boolean | null
          processed_at?: string | null
          receipt_id?: string | null
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          attachment_content_type?: string | null
          attachment_filename?: string
          attachment_size?: number | null
          created_at?: string | null
          duplicate_of?: string | null
          email_account_id?: string | null
          email_connection_id?: string | null
          email_from?: string | null
          email_import_id?: string | null
          email_message_id?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          error_message?: string | null
          file_hash?: string | null
          id?: string
          is_duplicate?: boolean | null
          processed_at?: string | null
          receipt_id?: string | null
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "email_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_email_connection_id_fkey"
            columns: ["email_connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_email_import_id_fkey"
            columns: ["email_import_id"]
            isOneToOne: false
            referencedRelation: "email_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_connections: {
        Row: {
          created_at: string | null
          id: string
          import_count: number | null
          import_email: string
          import_token: string
          is_active: boolean | null
          last_import_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          import_count?: number | null
          import_email: string
          import_token: string
          is_active?: boolean | null
          last_import_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          import_count?: number | null
          import_email?: string
          import_token?: string
          is_active?: boolean | null
          last_import_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_imports: {
        Row: {
          attachments_count: number | null
          email_connection_id: string
          error_message: string | null
          from_address: string | null
          id: string
          processed_receipts: number | null
          raw_data: Json | null
          received_at: string | null
          status: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          attachments_count?: number | null
          email_connection_id: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          processed_receipts?: number | null
          raw_data?: Json | null
          received_at?: string | null
          status?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          attachments_count?: number | null
          email_connection_id?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          processed_receipts?: number | null
          raw_data?: Json | null
          received_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_imports_email_connection_id_fkey"
            columns: ["email_connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_imports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      export_templates: {
        Row: {
          columns: Json
          created_at: string | null
          date_format: string | null
          description: string | null
          group_by: string | null
          group_subtotals: boolean | null
          id: string
          include_header: boolean | null
          include_totals: boolean | null
          is_default: boolean | null
          name: string
          number_format: string | null
          sort_by: string | null
          sort_direction: string | null
          template_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          columns?: Json
          created_at?: string | null
          date_format?: string | null
          description?: string | null
          group_by?: string | null
          group_subtotals?: boolean | null
          id?: string
          include_header?: boolean | null
          include_totals?: boolean | null
          is_default?: boolean | null
          name: string
          number_format?: string | null
          sort_by?: string | null
          sort_direction?: string | null
          template_type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          columns?: Json
          created_at?: string | null
          date_format?: string | null
          description?: string | null
          group_by?: string | null
          group_subtotals?: boolean | null
          id?: string
          include_header?: boolean | null
          include_totals?: boolean | null
          is_default?: boolean | null
          name?: string
          number_format?: string | null
          sort_by?: string | null
          sort_direction?: string | null
          template_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          images: string[] | null
          is_published: boolean
          question: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          images?: string[] | null
          is_published?: boolean
          question: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          images?: string[] | null
          is_published?: boolean
          question?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      field_corrections: {
        Row: {
          corrected_value: string
          created_at: string | null
          detected_value: string | null
          field_name: string
          id: string
          receipt_id: string | null
          surrounding_text: string | null
          user_id: string
          vendor_learning_id: string
          was_helpful: boolean | null
        }
        Insert: {
          corrected_value: string
          created_at?: string | null
          detected_value?: string | null
          field_name: string
          id?: string
          receipt_id?: string | null
          surrounding_text?: string | null
          user_id: string
          vendor_learning_id: string
          was_helpful?: boolean | null
        }
        Update: {
          corrected_value?: string
          created_at?: string | null
          detected_value?: string | null
          field_name?: string
          id?: string
          receipt_id?: string | null
          surrounding_text?: string | null
          user_id?: string
          vendor_learning_id?: string
          was_helpful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "field_corrections_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_corrections_vendor_learning_id_fkey"
            columns: ["vendor_learning_id"]
            isOneToOne: false
            referencedRelation: "vendor_learning"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          default_delivery_time: string | null
          description: string | null
          icon: string | null
          id: string
          image_path: string | null
          is_active: boolean | null
          item_group_id: string | null
          name: string
          sort_order: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          default_delivery_time?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean | null
          item_group_id?: string | null
          name: string
          sort_order?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          default_delivery_time?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean | null
          item_group_id?: string | null
          name?: string
          sort_order?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_item_group_id_fkey"
            columns: ["item_group_id"]
            isOneToOne: false
            referencedRelation: "item_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          delivery_time: string | null
          description: string
          group_name: string | null
          id: string
          image_path: string | null
          invoice_id: string
          invoice_item_id: string | null
          is_group_header: boolean | null
          line_total: number | null
          position: number | null
          quantity: number | null
          show_group_subtotal: boolean | null
          unit: string | null
          unit_price: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          delivery_time?: string | null
          description: string
          group_name?: string | null
          id?: string
          image_path?: string | null
          invoice_id: string
          invoice_item_id?: string | null
          is_group_header?: boolean | null
          line_total?: number | null
          position?: number | null
          quantity?: number | null
          show_group_subtotal?: boolean | null
          unit?: string | null
          unit_price?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          delivery_time?: string | null
          description?: string
          group_name?: string | null
          id?: string
          image_path?: string | null
          invoice_id?: string
          invoice_item_id?: string | null
          is_group_header?: boolean | null
          line_total?: number | null
          position?: number | null
          quantity?: number | null
          show_group_subtotal?: boolean | null
          unit?: string | null
          unit_price?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          auto_send_enabled: boolean | null
          bank_name: string | null
          bic: string | null
          company_logo_path: string | null
          created_at: string | null
          customer_number_format: string | null
          customer_number_prefix: string | null
          default_discount_days: number | null
          default_discount_percent: number | null
          default_footer_text: string | null
          default_notes: string | null
          default_payment_terms_days: number | null
          default_rabatt_percent: number | null
          delivery_note_prefix: string | null
          iban: string | null
          id: string
          invoice_number_format: string | null
          invoice_number_prefix: string | null
          layout_variant: string | null
          next_customer_number: number | null
          next_sequence_number: number | null
          order_confirmation_prefix: string | null
          overdue_reminder_days: number | null
          overdue_reminder_enabled: boolean | null
          send_copy_to_self: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_send_enabled?: boolean | null
          bank_name?: string | null
          bic?: string | null
          company_logo_path?: string | null
          created_at?: string | null
          customer_number_format?: string | null
          customer_number_prefix?: string | null
          default_discount_days?: number | null
          default_discount_percent?: number | null
          default_footer_text?: string | null
          default_notes?: string | null
          default_payment_terms_days?: number | null
          default_rabatt_percent?: number | null
          delivery_note_prefix?: string | null
          iban?: string | null
          id?: string
          invoice_number_format?: string | null
          invoice_number_prefix?: string | null
          layout_variant?: string | null
          next_customer_number?: number | null
          next_sequence_number?: number | null
          order_confirmation_prefix?: string | null
          overdue_reminder_days?: number | null
          overdue_reminder_enabled?: boolean | null
          send_copy_to_self?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_send_enabled?: boolean | null
          bank_name?: string | null
          bic?: string | null
          company_logo_path?: string | null
          created_at?: string | null
          customer_number_format?: string | null
          customer_number_prefix?: string | null
          default_discount_days?: number | null
          default_discount_percent?: number | null
          default_footer_text?: string | null
          default_notes?: string | null
          default_payment_terms_days?: number | null
          default_rabatt_percent?: number | null
          delivery_note_prefix?: string | null
          iban?: string | null
          id?: string
          invoice_number_format?: string | null
          invoice_number_prefix?: string | null
          layout_variant?: string | null
          next_customer_number?: number | null
          next_sequence_number?: number | null
          order_confirmation_prefix?: string | null
          overdue_reminder_days?: number | null
          overdue_reminder_enabled?: boolean | null
          send_copy_to_self?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tags: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tags_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          category: string | null
          copied_from_id: string | null
          created_at: string | null
          credit_note_for: string | null
          currency: string | null
          customer_id: string
          delivery_time: string | null
          discount_amount: number | null
          discount_days: number | null
          discount_percent: number | null
          document_type: string | null
          due_date: string | null
          footer_text: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          invoice_subtype: string | null
          notes: string | null
          paid_at: string | null
          parent_invoice_id: string | null
          payment_reference: string | null
          pdf_storage_path: string | null
          rabatt_percent: number | null
          recurring_invoice_id: string | null
          related_order_id: string | null
          sent_at: string | null
          sent_to_email: string | null
          shipping_address_mode: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_street: string | null
          shipping_zip: string | null
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
          user_id: string
          vat_total: number | null
          version: string | null
        }
        Insert: {
          category?: string | null
          copied_from_id?: string | null
          created_at?: string | null
          credit_note_for?: string | null
          currency?: string | null
          customer_id: string
          delivery_time?: string | null
          discount_amount?: number | null
          discount_days?: number | null
          discount_percent?: number | null
          document_type?: string | null
          due_date?: string | null
          footer_text?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          invoice_subtype?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_reference?: string | null
          pdf_storage_path?: string | null
          rabatt_percent?: number | null
          recurring_invoice_id?: string | null
          related_order_id?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          shipping_address_mode?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_street?: string | null
          shipping_zip?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          user_id: string
          vat_total?: number | null
          version?: string | null
        }
        Update: {
          category?: string | null
          copied_from_id?: string | null
          created_at?: string | null
          credit_note_for?: string | null
          currency?: string | null
          customer_id?: string
          delivery_time?: string | null
          discount_amount?: number | null
          discount_days?: number | null
          discount_percent?: number | null
          document_type?: string | null
          due_date?: string | null
          footer_text?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          invoice_subtype?: string | null
          notes?: string | null
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_reference?: string | null
          pdf_storage_path?: string | null
          rabatt_percent?: number | null
          recurring_invoice_id?: string | null
          related_order_id?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          shipping_address_mode?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_street?: string | null
          shipping_zip?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
          vat_total?: number | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_credit_note_for_fkey"
            columns: ["credit_note_for"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_recurring_invoice_id_fkey"
            columns: ["recurring_invoice_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          provider: string
          redirect_after: string | null
          state_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          redirect_after?: string | null
          state_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          redirect_after?: string | null
          state_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          admin_view_plan: string | null
          avatar_url: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          description_settings: Json | null
          document_credit: number
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          monthly_document_count: number
          monthly_receipt_count: number | null
          naming_settings: Json | null
          newsletter_opt_in: boolean | null
          onboarding_completed: boolean | null
          phone: string | null
          plan: string | null
          receipt_credit: number | null
          street: string | null
          stripe_customer_id: string | null
          stripe_product_id: string | null
          subscription_end_date: string | null
          subscription_status: string | null
          trialed_plans: string[] | null
          uid_number: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          account_type?: string | null
          admin_view_plan?: string | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          description_settings?: Json | null
          document_credit?: number
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          monthly_document_count?: number
          monthly_receipt_count?: number | null
          naming_settings?: Json | null
          newsletter_opt_in?: boolean | null
          onboarding_completed?: boolean | null
          phone?: string | null
          plan?: string | null
          receipt_credit?: number | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          trialed_plans?: string[] | null
          uid_number?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          account_type?: string | null
          admin_view_plan?: string | null
          avatar_url?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          description_settings?: Json | null
          document_credit?: number
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          monthly_document_count?: number
          monthly_receipt_count?: number | null
          naming_settings?: Json | null
          newsletter_opt_in?: boolean | null
          onboarding_completed?: boolean | null
          phone?: string | null
          plan?: string | null
          receipt_credit?: number | null
          street?: string | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          trialed_plans?: string[] | null
          uid_number?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      quote_settings: {
        Row: {
          created_at: string | null
          default_footer_text: string | null
          default_notes: string | null
          default_validity_days: number | null
          id: string
          layout_variant: string | null
          next_sequence_number: number | null
          quote_number_format: string | null
          quote_number_prefix: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_footer_text?: string | null
          default_notes?: string | null
          default_validity_days?: number | null
          id?: string
          layout_variant?: string | null
          next_sequence_number?: number | null
          quote_number_format?: string | null
          quote_number_prefix?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_footer_text?: string | null
          default_notes?: string | null
          default_validity_days?: number | null
          id?: string
          layout_variant?: string | null
          next_sequence_number?: number | null
          quote_number_format?: string | null
          quote_number_prefix?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_tags: {
        Row: {
          created_at: string | null
          id: string
          receipt_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          receipt_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          receipt_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_tags_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          ai_confidence: number | null
          ai_processed_at: string | null
          ai_raw_response: Json | null
          amount_gross: number | null
          amount_net: number | null
          auto_approved: boolean
          bank_import_keyword_id: string | null
          bank_transaction_id: string | null
          bank_transaction_reference: string | null
          category: string | null
          cloud_backup_at: string | null
          created_at: string | null
          currency: string | null
          custom_filename: string | null
          description: string | null
          duplicate_checked_at: string | null
          duplicate_of: string | null
          duplicate_score: number | null
          email_attachment_id: string | null
          file_hash: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          invoice_number: string | null
          is_duplicate: boolean | null
          is_mixed_tax_rate: boolean | null
          is_no_receipt_entry: boolean | null
          line_items_raw: Json | null
          notes: string | null
          original_pages: number[] | null
          page_count: number | null
          payment_method: string | null
          receipt_date: string | null
          source: string | null
          special_vat_case: string | null
          split_from_receipt_id: string | null
          split_suggestion: Json | null
          status: string | null
          tax_rate_details: Json | null
          updated_at: string | null
          user_id: string
          user_modified_fields: string[] | null
          vat_amount: number | null
          vat_confidence: number | null
          vat_detection_method: string | null
          vat_rate: number | null
          vat_rate_source: string | null
          vendor: string | null
          vendor_brand: string | null
          vendor_country: string | null
          vendor_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_processed_at?: string | null
          ai_raw_response?: Json | null
          amount_gross?: number | null
          amount_net?: number | null
          auto_approved?: boolean
          bank_import_keyword_id?: string | null
          bank_transaction_id?: string | null
          bank_transaction_reference?: string | null
          category?: string | null
          cloud_backup_at?: string | null
          created_at?: string | null
          currency?: string | null
          custom_filename?: string | null
          description?: string | null
          duplicate_checked_at?: string | null
          duplicate_of?: string | null
          duplicate_score?: number | null
          email_attachment_id?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          is_duplicate?: boolean | null
          is_mixed_tax_rate?: boolean | null
          is_no_receipt_entry?: boolean | null
          line_items_raw?: Json | null
          notes?: string | null
          original_pages?: number[] | null
          page_count?: number | null
          payment_method?: string | null
          receipt_date?: string | null
          source?: string | null
          special_vat_case?: string | null
          split_from_receipt_id?: string | null
          split_suggestion?: Json | null
          status?: string | null
          tax_rate_details?: Json | null
          updated_at?: string | null
          user_id: string
          user_modified_fields?: string[] | null
          vat_amount?: number | null
          vat_confidence?: number | null
          vat_detection_method?: string | null
          vat_rate?: number | null
          vat_rate_source?: string | null
          vendor?: string | null
          vendor_brand?: string | null
          vendor_country?: string | null
          vendor_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_processed_at?: string | null
          ai_raw_response?: Json | null
          amount_gross?: number | null
          amount_net?: number | null
          auto_approved?: boolean
          bank_import_keyword_id?: string | null
          bank_transaction_id?: string | null
          bank_transaction_reference?: string | null
          category?: string | null
          cloud_backup_at?: string | null
          created_at?: string | null
          currency?: string | null
          custom_filename?: string | null
          description?: string | null
          duplicate_checked_at?: string | null
          duplicate_of?: string | null
          duplicate_score?: number | null
          email_attachment_id?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          invoice_number?: string | null
          is_duplicate?: boolean | null
          is_mixed_tax_rate?: boolean | null
          is_no_receipt_entry?: boolean | null
          line_items_raw?: Json | null
          notes?: string | null
          original_pages?: number[] | null
          page_count?: number | null
          payment_method?: string | null
          receipt_date?: string | null
          source?: string | null
          special_vat_case?: string | null
          split_from_receipt_id?: string | null
          split_suggestion?: Json | null
          status?: string | null
          tax_rate_details?: Json | null
          updated_at?: string | null
          user_id?: string
          user_modified_fields?: string[] | null
          vat_amount?: number | null
          vat_confidence?: number | null
          vat_detection_method?: string | null
          vat_rate?: number | null
          vat_rate_source?: string | null
          vendor?: string | null
          vendor_brand?: string | null
          vendor_country?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_bank_import_keyword_id_fkey"
            columns: ["bank_import_keyword_id"]
            isOneToOne: false
            referencedRelation: "bank_import_keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_email_attachment_id_fkey"
            columns: ["email_attachment_id"]
            isOneToOne: false
            referencedRelation: "email_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_split_from_receipt_id_fkey"
            columns: ["split_from_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          auto_send: boolean | null
          created_at: string | null
          customer_id: string
          footer_text: string | null
          id: string
          interval: string
          is_active: boolean | null
          last_generated_at: string | null
          next_invoice_date: string | null
          notes: string | null
          template_line_items: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_send?: boolean | null
          created_at?: string | null
          customer_id: string
          footer_text?: string | null
          id?: string
          interval?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          next_invoice_date?: string | null
          notes?: string | null
          template_line_items?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_send?: boolean | null
          created_at?: string | null
          customer_id?: string
          footer_text?: string | null
          id?: string
          interval?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          next_invoice_date?: string | null
          notes?: string | null
          template_line_items?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          area: string | null
          created_at: string
          id: string
          images: string[] | null
          message: string
          replied_at: string | null
          replied_by: string | null
          reward_applied_at: string | null
          reward_status: string | null
          status: string
          subject: string
          ticket_type: string
          updated_at: string
          user_email: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          area?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          message: string
          replied_at?: string | null
          replied_by?: string | null
          reward_applied_at?: string | null
          reward_status?: string | null
          status?: string
          subject: string
          ticket_type?: string
          updated_at?: string
          user_email: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          area?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          message?: string
          replied_at?: string | null
          replied_by?: string | null
          reward_applied_at?: string | null
          reward_status?: string | null
          status?: string
          subject?: string
          ticket_type?: string
          updated_at?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_learning: {
        Row: {
          confidence_boost: number | null
          created_at: string | null
          default_vat_rate: number | null
          field_patterns: Json | null
          id: string
          is_active: boolean | null
          last_correction_at: string | null
          last_successful_at: string | null
          layout_hints: Json | null
          learning_level: number | null
          successful_predictions: number | null
          total_corrections: number | null
          updated_at: string | null
          user_id: string
          vat_rate_confidence: number | null
          vat_rate_corrections: number | null
          vendor_id: string
        }
        Insert: {
          confidence_boost?: number | null
          created_at?: string | null
          default_vat_rate?: number | null
          field_patterns?: Json | null
          id?: string
          is_active?: boolean | null
          last_correction_at?: string | null
          last_successful_at?: string | null
          layout_hints?: Json | null
          learning_level?: number | null
          successful_predictions?: number | null
          total_corrections?: number | null
          updated_at?: string | null
          user_id: string
          vat_rate_confidence?: number | null
          vat_rate_corrections?: number | null
          vendor_id: string
        }
        Update: {
          confidence_boost?: number | null
          created_at?: string | null
          default_vat_rate?: number | null
          field_patterns?: Json | null
          id?: string
          is_active?: boolean | null
          last_correction_at?: string | null
          last_successful_at?: string | null
          layout_hints?: Json | null
          learning_level?: number | null
          successful_predictions?: number | null
          total_corrections?: number | null
          updated_at?: string | null
          user_id?: string
          vat_rate_confidence?: number | null
          vat_rate_corrections?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_learning_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_learning_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_vat_rates: {
        Row: {
          created_at: string | null
          frequency: number | null
          id: string
          last_used_at: string | null
          user_id: string
          vat_rate: number
          vendor_learning_id: string | null
        }
        Insert: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          last_used_at?: string | null
          user_id: string
          vat_rate: number
          vendor_learning_id?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          last_used_at?: string | null
          user_id?: string
          vat_rate?: number
          vendor_learning_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_vat_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_vat_rates_vendor_learning_id_fkey"
            columns: ["vendor_learning_id"]
            isOneToOne: false
            referencedRelation: "vendor_learning"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          auto_approve: boolean
          auto_approve_min_confidence: number
          correction_count: number | null
          created_at: string | null
          default_category_id: string | null
          default_payment_method: string | null
          default_tag_id: string | null
          default_vat_rate: number | null
          detected_names: string[] | null
          display_name: string
          expenses_only_extraction: boolean
          extraction_hint: string | null
          extraction_keywords: string[]
          id: string
          learning_enabled: boolean | null
          learning_level: number | null
          legal_names: string[] | null
          notes: string | null
          prediction_accuracy: number | null
          receipt_count: number | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          auto_approve?: boolean
          auto_approve_min_confidence?: number
          correction_count?: number | null
          created_at?: string | null
          default_category_id?: string | null
          default_payment_method?: string | null
          default_tag_id?: string | null
          default_vat_rate?: number | null
          detected_names?: string[] | null
          display_name: string
          expenses_only_extraction?: boolean
          extraction_hint?: string | null
          extraction_keywords?: string[]
          id?: string
          learning_enabled?: boolean | null
          learning_level?: number | null
          legal_names?: string[] | null
          notes?: string | null
          prediction_accuracy?: number | null
          receipt_count?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          auto_approve?: boolean
          auto_approve_min_confidence?: number
          correction_count?: number | null
          created_at?: string | null
          default_category_id?: string | null
          default_payment_method?: string | null
          default_tag_id?: string | null
          default_vat_rate?: number | null
          detected_names?: string[] | null
          display_name?: string
          expenses_only_extraction?: boolean
          extraction_hint?: string | null
          extraction_keywords?: string[]
          id?: string
          learning_enabled?: boolean | null
          learning_level?: number | null
          legal_names?: string[] | null
          notes?: string | null
          prediction_accuracy?: number | null
          receipt_count?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_default_tag_id_fkey"
            columns: ["default_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reset_checklist: { Args: { p_checklist_id: string }; Returns: undefined }
      reset_monthly_credits: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
