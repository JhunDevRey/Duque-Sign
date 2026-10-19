// Schema snapshot based on supabase/migrations/001_init.sql through 006_api_keys.sql.
// Regenerate from the live project with `supabase gen types typescript --project-id <project-ref> --schema public`.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type TimestampColumns = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        { id: string; email: string | null; display_name: string | null } & TimestampColumns,
        { id: string; email?: string | null; display_name?: string | null; created_at?: string; updated_at?: string },
        { email?: string | null; display_name?: string | null; updated_at?: string }
      >;
      organizations: TableDefinition<
        { id: string; name: string; created_by: string; settings: Json } & TimestampColumns,
        { id?: string; name: string; created_by: string; settings?: Json; created_at?: string; updated_at?: string },
        { name?: string; settings?: Json; updated_at?: string }
      >;
      organization_members: TableDefinition<
        { organization_id: string; user_id: string; role: Database["public"]["Enums"]["organization_member_role"]; joined_at: string },
        { organization_id: string; user_id: string; role?: Database["public"]["Enums"]["organization_member_role"]; joined_at?: string },
        { role?: Database["public"]["Enums"]["organization_member_role"] }
      >;
      templates: TableDefinition<
        { id: string; organization_id: string; name: string; roles: Json; fields: Json; variables: Json; created_by: string } & TimestampColumns,
        { id?: string; organization_id: string; name: string; roles?: Json; fields?: Json; variables?: Json; created_by: string; created_at?: string; updated_at?: string },
        { name?: string; roles?: Json; fields?: Json; variables?: Json; updated_at?: string }
      >;
      documents: TableDefinition<
        {
          id: string;
          organization_id: string;
          title: string;
          status: Database["public"]["Enums"]["document_status"];
          created_by: string;
          version: number;
          sent_at: string | null;
          expires_at: string | null;
          completed_at: string | null;
          original_pdf_path: string | null;
          original_file_name: string | null;
          final_pdf_path: string | null;
          final_pdf_sha256: string | null;
          page_count: number;
          external_id: string | null;
          metadata: Json;
        } & TimestampColumns,
        {
          id?: string;
          organization_id: string;
          title: string;
          status?: Database["public"]["Enums"]["document_status"];
          created_by: string;
          version?: number;
          sent_at?: string | null;
          expires_at?: string | null;
          completed_at?: string | null;
          original_pdf_path?: string | null;
          original_file_name?: string | null;
          final_pdf_path?: string | null;
          final_pdf_sha256?: string | null;
          page_count: number;
          external_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        },
        {
          title?: string;
          status?: Database["public"]["Enums"]["document_status"];
          version?: number;
          sent_at?: string | null;
          expires_at?: string | null;
          completed_at?: string | null;
          original_pdf_path?: string | null;
          original_file_name?: string | null;
          final_pdf_path?: string | null;
          final_pdf_sha256?: string | null;
          page_count?: number;
          external_id?: string | null;
          metadata?: Json;
          updated_at?: string;
        }
      >;
      document_versions: TableDefinition<
        {
          id: string;
          organization_id: string;
          document_id: string;
          version_number: number;
          original_pdf_path: string | null;
          final_pdf_path: string | null;
          final_pdf_sha256: string | null;
          page_count: number;
          created_by: string;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          document_id: string;
          version_number: number;
          original_pdf_path?: string | null;
          final_pdf_path?: string | null;
          final_pdf_sha256?: string | null;
          page_count: number;
          created_by: string;
          created_at?: string;
        },
        never
      >;
      recipients: TableDefinition<
        {
          id: string;
          organization_id: string;
          document_id: string;
          name: string;
          email: string;
          role: string;
          signing_order: number;
          delivery: string;
          status: Database["public"]["Enums"]["recipient_status"];
          signing_token_hash: string | null;
          signed_at: string | null;
          viewed_at: string | null;
          declined_at: string | null;
          decline_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          document_id: string;
          name: string;
          email: string;
          role: string;
          signing_order: number;
          delivery?: string;
          status?: Database["public"]["Enums"]["recipient_status"];
          signing_token_hash?: string | null;
          signed_at?: string | null;
          viewed_at?: string | null;
          declined_at?: string | null;
          decline_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          email?: string;
          role?: string;
          signing_order?: number;
          delivery?: string;
          status?: Database["public"]["Enums"]["recipient_status"];
          signing_token_hash?: string | null;
          signed_at?: string | null;
          updated_at?: string;
        }
      >;
      fields: TableDefinition<
        {
          id: string;
          organization_id: string;
          document_id: string;
          recipient_id: string;
          type: string;
          page: number;
          x: number;
          y: number;
          w: number;
          h: number;
          required: boolean;
          label: string | null;
          source: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          organization_id: string;
          document_id: string;
          recipient_id: string;
          type: string;
          page: number;
          x: number;
          y: number;
          w: number;
          h: number;
          required?: boolean;
          label?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          type?: string;
          page?: number;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          required?: boolean;
          label?: string | null;
          source?: string;
          updated_at?: string;
        }
      >;
      field_values: TableDefinition<
        { field_id: string; organization_id: string; document_id: string; recipient_id: string; value: string; created_at: string },
        never,
        never
      >;
      audit_events: TableDefinition<
        {
          id: string;
          organization_id: string;
          document_id: string;
          recipient_id: string | null;
          actor_user_id: string | null;
          actor_type: string;
          event_type: string;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          organization_id: string;
          document_id: string;
          recipient_id?: string | null;
          actor_user_id?: string | null;
          actor_type: string;
          event_type: string;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        },
        never
      >;
      // key_hash is not granted to signed-in users; only the service role can read it.
      api_keys: TableDefinition<
        {
          id: string;
          organization_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          created_by: string;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        },
        never,
        never
      >;
      api_idempotency_keys: TableDefinition<
        {
          organization_id: string;
          idempotency_key: string;
          request_hash: string;
          response_status: number | null;
          response_body: Json | null;
          created_at: string;
        },
        never,
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      api_authenticate_key: {
        Args: { p_key_hash: string };
        Returns: { api_key_id: string; organization_id: string; organization_name: string }[];
      };
      api_claim_idempotency: {
        Args: { p_api_key_id: string; p_idempotency_key: string; p_request_hash: string };
        Returns: { state: "claimed" | "replay" | "mismatch" | "in_progress"; response_status: number | null; response_body: Json | null }[];
      };
      api_complete_idempotency: {
        Args: { p_api_key_id: string; p_idempotency_key: string; p_response_status: number; p_response_body: Json };
        Returns: undefined;
      };
      api_create_document: {
        Args: {
          p_api_key_id: string;
          p_document_id: string;
          p_title: string;
          p_external_id: string | null;
          p_metadata: Json;
          p_original_file_name: string;
          p_original_pdf_path: string;
          p_page_count: number;
          p_recipients: Json;
          p_fields: Json;
        };
        Returns: undefined;
      };
      api_release_idempotency: { Args: { p_api_key_id: string; p_idempotency_key: string }; Returns: undefined };
      api_send_document: {
        Args: { p_api_key_id: string; p_document_id: string; p_token_hashes: Json; p_expires_in_days: number };
        Returns: {
          recipient_id: string;
          status: Database["public"]["Enums"]["recipient_status"];
          expires_at: string;
        }[];
      };
      can_view_profile: { Args: { target_user_id: string }; Returns: boolean };
      cancel_document: { Args: { p_document_id: string }; Returns: undefined };
      create_api_key: {
        Args: { p_organization_id: string; p_name: string; p_key_prefix: string; p_key_hash: string };
        Returns: string;
      };
      create_organization: {
        Args: { p_name: string };
        Returns: { id: string; name: string; role: Database["public"]["Enums"]["organization_member_role"] }[];
      };
      create_draft_document: {
        Args: {
          p_document_id: string;
          p_organization_id: string;
          p_title: string;
          p_external_id: string | null;
          p_original_file_name: string;
          p_original_pdf_path: string;
          p_page_count: number;
          p_recipients: Json;
        };
        Returns: Database["public"]["Tables"]["recipients"]["Row"][];
      };
      is_organization_admin: { Args: { target_organization_id: string }; Returns: boolean };
      is_organization_admin_for_storage: { Args: { object_name: string }; Returns: boolean };
      is_organization_member: { Args: { target_organization_id: string }; Returns: boolean };
      is_organization_member_for_storage: { Args: { object_name: string }; Returns: boolean };
      replace_document_fields: { Args: { p_document_id: string; p_fields: Json }; Returns: number };
      revoke_api_key: { Args: { p_api_key_id: string }; Returns: undefined };
      reissue_signing_link: {
        Args: { p_document_id: string; p_recipient_id: string; p_token_hash: string };
        Returns: undefined;
      };
      open_signing_session: { Args: { p_token_hash: string; p_ip: string; p_user_agent: string }; Returns: Json };
      submit_signature: {
        Args: { p_token_hash: string; p_values: Json; p_consent: boolean; p_ip: string; p_user_agent: string };
        Returns: Json;
      };
      decline_signing: {
        Args: { p_token_hash: string; p_reason: string; p_ip: string; p_user_agent: string };
        Returns: undefined;
      };
      finalization_payload: { Args: { p_document_id: string }; Returns: Json };
      finalize_document: { Args: { p_document_id: string; p_final_pdf_path: string; p_sha256: string }; Returns: undefined };
      send_document: {
        Args: { p_document_id: string; p_token_hashes: Json; p_expires_in_days: number };
        Returns: {
          recipient_id: string;
          status: Database["public"]["Enums"]["recipient_status"];
          expires_at: string;
        }[];
      };
    };
    Enums: {
      document_status: "draft" | "sent" | "in_progress" | "completed" | "declined" | "cancelled" | "expired";
      organization_member_role: "owner" | "admin" | "member";
      recipient_status: "waiting" | "sent" | "viewed" | "signed" | "declined";
    };
    CompositeTypes: Record<string, never>;
  };
};
