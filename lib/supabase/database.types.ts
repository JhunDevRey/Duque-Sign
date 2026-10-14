// Schema snapshot based on supabase/migrations/001_init.sql through 003_create_organization.sql.
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
    };
    Views: Record<string, never>;
    Functions: {
      can_view_profile: { Args: { target_user_id: string }; Returns: boolean };
      cancel_document: { Args: { p_document_id: string }; Returns: undefined };
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
    };
    Enums: {
      document_status: "draft" | "sent" | "in_progress" | "completed" | "declined" | "cancelled" | "expired";
      organization_member_role: "owner" | "admin" | "member";
      recipient_status: "waiting" | "sent" | "viewed" | "signed" | "declined";
    };
    CompositeTypes: Record<string, never>;
  };
};
