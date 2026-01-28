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
          id: string
          import_batch_id: string | null
          is_expense: boolean | null
          raw_data: Json | null
          receipt_id: string | null
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
          id?: string
          import_batch_id?: string | null
          is_expense?: boolean | null
          raw_data?: Json | null
          receipt_id?: string | null
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
          id?: string
          import_batch_id?: string | null
          is_expense?: boolean | null
          raw_data?: Json | null
          receipt_id?: string | null
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
      cloud_connections: {
        Row: {
          access_token: string | null
          created_at: string | null
          folder_path: string | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          provider: string | null
          refresh_token: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          folder_path?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          provider?: string | null
          refresh_token?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          folder_path?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          provider?: string | null
          refresh_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_connections_user_id_fkey"
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
          email_connection_id: string
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
          email_connection_id: string
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
          email_connection_id?: string
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
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          description_settings: Json | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          monthly_receipt_count: number | null
          naming_settings: Json | null
          plan: string | null
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          description_settings?: Json | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          monthly_receipt_count?: number | null
          naming_settings?: Json | null
          plan?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          description_settings?: Json | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          monthly_receipt_count?: number | null
          naming_settings?: Json | null
          plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          ai_confidence: number | null
          ai_processed_at: string | null
          ai_raw_response: Json | null
          amount_gross: number | null
          amount_net: number | null
          bank_transaction_id: string | null
          category: string | null
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
          line_items_raw: Json | null
          notes: string | null
          payment_method: string | null
          receipt_date: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          user_modified_fields: string[] | null
          vat_amount: number | null
          vat_rate: number | null
          vat_rate_source: string | null
          vendor: string | null
          vendor_brand: string | null
          vendor_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_processed_at?: string | null
          ai_raw_response?: Json | null
          amount_gross?: number | null
          amount_net?: number | null
          bank_transaction_id?: string | null
          category?: string | null
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
          line_items_raw?: Json | null
          notes?: string | null
          payment_method?: string | null
          receipt_date?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          user_modified_fields?: string[] | null
          vat_amount?: number | null
          vat_rate?: number | null
          vat_rate_source?: string | null
          vendor?: string | null
          vendor_brand?: string | null
          vendor_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_processed_at?: string | null
          ai_raw_response?: Json | null
          amount_gross?: number | null
          amount_net?: number | null
          bank_transaction_id?: string | null
          category?: string | null
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
          line_items_raw?: Json | null
          notes?: string | null
          payment_method?: string | null
          receipt_date?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          user_modified_fields?: string[] | null
          vat_amount?: number | null
          vat_rate?: number | null
          vat_rate_source?: string | null
          vendor?: string | null
          vendor_brand?: string | null
          vendor_id?: string | null
        }
        Relationships: [
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
          correction_count: number | null
          created_at: string | null
          default_category_id: string | null
          default_vat_rate: number | null
          detected_names: string[] | null
          display_name: string
          id: string
          learning_enabled: boolean | null
          learning_level: number | null
          legal_name: string | null
          notes: string | null
          prediction_accuracy: number | null
          receipt_count: number | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          correction_count?: number | null
          created_at?: string | null
          default_category_id?: string | null
          default_vat_rate?: number | null
          detected_names?: string[] | null
          display_name: string
          id?: string
          learning_enabled?: boolean | null
          learning_level?: number | null
          legal_name?: string | null
          notes?: string | null
          prediction_accuracy?: number | null
          receipt_count?: number | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          correction_count?: number | null
          created_at?: string | null
          default_category_id?: string | null
          default_vat_rate?: number | null
          detected_names?: string[] | null
          display_name?: string
          id?: string
          learning_enabled?: boolean | null
          learning_level?: number | null
          legal_name?: string | null
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
    Enums: {},
  },
} as const
