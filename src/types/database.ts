export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: 'user' | 'admin';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: 'user' | 'admin';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'user' | 'admin';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string | null;
          visibility: 'public' | 'private';
          source_type: 'pdf' | 'docx' | 'txt' | 'md' | 'url';
          title: string;
          storage_path: string | null;
          source_url: string | null;
          status: 'pending' | 'processing' | 'ready' | 'failed';
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          visibility: 'public' | 'private';
          source_type: 'pdf' | 'docx' | 'txt' | 'md' | 'url';
          title: string;
          storage_path?: string | null;
          source_url?: string | null;
          status?: 'pending' | 'processing' | 'ready' | 'failed';
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          visibility?: 'public' | 'private';
          source_type?: 'pdf' | 'docx' | 'txt' | 'md' | 'url';
          title?: string;
          storage_path?: string | null;
          source_url?: string | null;
          status?: 'pending' | 'processing' | 'ready' | 'failed';
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      chunks: {
        Row: {
          id: string;
          document_id: string;
          ordinal: number;
          content: string;
          embedding: string;
          dieu: string | null;
          khoan: string | null;
          diem: string | null;
          page: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          ordinal: number;
          content: string;
          embedding: string;
          dieu?: string | null;
          khoan?: string | null;
          diem?: string | null;
          page?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          ordinal?: number;
          content?: string;
          embedding?: string;
          dieu?: string | null;
          khoan?: string | null;
          diem?: string | null;
          page?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chunks_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          citations: Json;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          citations?: Json;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          citations?: Json;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_daily: {
        Row: {
          user_id: string;
          day: string;
          question_count: number;
        };
        Insert: {
          user_id: string;
          day: string;
          question_count?: number;
        };
        Update: {
          user_id?: string;
          day?: string;
          question_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_daily_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
