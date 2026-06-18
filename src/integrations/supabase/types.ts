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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ads_audits: {
        Row: {
          campaign_name: string
          client_name: string
          created_at: string
          diagnosis: Json
          id: string
          platform: string
          score: number
          slug: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_name?: string
          client_name?: string
          created_at?: string
          diagnosis?: Json
          id?: string
          platform?: string
          score?: number
          slug: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_name?: string
          client_name?: string
          created_at?: string
          diagnosis?: Json
          id?: string
          platform?: string
          score?: number
          slug?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount: number
          contract_id: string
          created_at: string
          id: string
          notes: string
          paid_at: string | null
          reference_month: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount?: number
          contract_id: string
          created_at?: string
          id?: string
          notes?: string
          paid_at?: string | null
          reference_month?: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string
          paid_at?: string | null
          reference_month?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "affiliate_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_contracts: {
        Row: {
          affiliate_id: string
          cancelled_at: string | null
          client_name: string
          created_at: string
          id: string
          lead_id: string | null
          monthly_value: number
          notes: string
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          cancelled_at?: string | null
          client_name: string
          created_at?: string
          id?: string
          lead_id?: string | null
          monthly_value?: number
          notes?: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          cancelled_at?: string | null
          client_name?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          monthly_value?: number
          notes?: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_contracts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "affiliate_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_leads: {
        Row: {
          affiliate_id: string
          company: string
          converted_at: string | null
          created_at: string
          email: string
          id: string
          lead_name: string
          notes: string
          status: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          affiliate_id: string
          company?: string
          converted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_name: string
          notes?: string
          status?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          affiliate_id?: string
          company?: string
          converted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_name?: string
          notes?: string
          status?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          closing_commission: number | null
          created_at: string
          id: string
          recurring_commission: number | null
          updated_at: string
          vsl_video_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          closing_commission?: number | null
          created_at?: string
          id?: string
          recurring_commission?: number | null
          updated_at?: string
          vsl_video_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          closing_commission?: number | null
          created_at?: string
          id?: string
          recurring_commission?: number | null
          updated_at?: string
          vsl_video_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      affiliate_video_lessons: {
        Row: {
          created_at: string
          description: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city_state: string
          cpf_cnpj: string
          created_at: string
          email: string
          full_name: string
          how_found: string
          id: string
          instagram: string
          sales_experience: boolean
          slug: string | null
          status: string
          updated_at: string
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city_state?: string
          cpf_cnpj?: string
          created_at?: string
          email: string
          full_name: string
          how_found?: string
          id?: string
          instagram?: string
          sales_experience?: boolean
          slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city_state?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          full_name?: string
          how_found?: string
          id?: string
          instagram?: string
          sales_experience?: boolean
          slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          actual_cost: number
          budget_id: string
          category: string
          created_at: string
          description: string
          estimated_cost: number
          id: string
        }
        Insert: {
          actual_cost?: number
          budget_id: string
          category?: string
          created_at?: string
          description?: string
          estimated_cost?: number
          id?: string
        }
        Update: {
          actual_cost?: number
          budget_id?: string
          category?: string
          created_at?: string
          description?: string
          estimated_cost?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          client_id: string | null
          created_at: string
          date: string
          id: string
          title: string
          type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date: string
          id?: string
          title: string
          type?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date?: string
          id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          author_avatar: string | null
          author_id: string
          author_name: string
          channel: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author_avatar?: string | null
          author_id: string
          author_name?: string
          channel?: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author_avatar?: string | null
          author_id?: string
          author_name?: string
          channel?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      client_briefings: {
        Row: {
          audience_desires: string
          audience_pain_points: string
          client_id: string | null
          communication_style: string
          company_name: string
          competitors: string
          created_at: string
          current_perception: string
          desired_perception: string
          differentials: string
          goals_3_months: string
          id: string
          instagram: string
          monthly_revenue: string
          phone: string
          purchase_blockers: string
          purchase_triggers: string
          responsible_name: string
          segment: string
          status: string
          target_age_range: string
          target_gender: string
          things_to_avoid: string
          updated_at: string
        }
        Insert: {
          audience_desires?: string
          audience_pain_points?: string
          client_id?: string | null
          communication_style?: string
          company_name?: string
          competitors?: string
          created_at?: string
          current_perception?: string
          desired_perception?: string
          differentials?: string
          goals_3_months?: string
          id?: string
          instagram?: string
          monthly_revenue?: string
          phone?: string
          purchase_blockers?: string
          purchase_triggers?: string
          responsible_name?: string
          segment?: string
          status?: string
          target_age_range?: string
          target_gender?: string
          things_to_avoid?: string
          updated_at?: string
        }
        Update: {
          audience_desires?: string
          audience_pain_points?: string
          client_id?: string | null
          communication_style?: string
          company_name?: string
          competitors?: string
          created_at?: string
          current_perception?: string
          desired_perception?: string
          differentials?: string
          goals_3_months?: string
          id?: string
          instagram?: string
          monthly_revenue?: string
          phone?: string
          purchase_blockers?: string
          purchase_triggers?: string
          responsible_name?: string
          segment?: string
          status?: string
          target_age_range?: string
          target_gender?: string
          things_to_avoid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_meta_accounts: {
        Row: {
          access_token: string
          account_name: string
          client_id: string
          created_at: string
          facebook_page_id: string
          id: string
          instagram_account_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          account_name?: string
          client_id: string
          created_at?: string
          facebook_page_id?: string
          id?: string
          instagram_account_id?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_name?: string
          client_id?: string
          created_at?: string
          facebook_page_id?: string
          id?: string
          instagram_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_meta_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_scope_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          scope_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          scope_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          scope_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_scope_tasks_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "client_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_scopes: {
        Row: {
          client_id: string
          created_at: string
          id: string
          month: string
          notes: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          month: string
          notes?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_scopes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_weekly_results: {
        Row: {
          ad_spend: number
          client_id: string
          content_posted: number
          cost_per_lead: number
          created_at: string
          engagement_rate: number
          followers_after: number
          followers_before: number
          highlights: string
          id: string
          leads_generated: number
          notes: string
          reels_posted: number
          revenue_generated: number
          roas: number
          sales_closed: number
          stories_posted: number
          total_comments: number
          total_impressions: number
          total_likes: number
          total_reach: number
          total_saves: number
          total_shares: number
          updated_at: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          ad_spend?: number
          client_id: string
          content_posted?: number
          cost_per_lead?: number
          created_at?: string
          engagement_rate?: number
          followers_after?: number
          followers_before?: number
          highlights?: string
          id?: string
          leads_generated?: number
          notes?: string
          reels_posted?: number
          revenue_generated?: number
          roas?: number
          sales_closed?: number
          stories_posted?: number
          total_comments?: number
          total_impressions?: number
          total_likes?: number
          total_reach?: number
          total_saves?: number
          total_shares?: number
          updated_at?: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          ad_spend?: number
          client_id?: string
          content_posted?: number
          cost_per_lead?: number
          created_at?: string
          engagement_rate?: number
          followers_after?: number
          followers_before?: number
          highlights?: string
          id?: string
          leads_generated?: number
          notes?: string
          reels_posted?: number
          revenue_generated?: number
          roas?: number
          sales_closed?: number
          stories_posted?: number
          total_comments?: number
          total_impressions?: number
          total_likes?: number
          total_reach?: number
          total_saves?: number
          total_shares?: number
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_weekly_results_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager: string
          company_name: string
          contact_name: string
          contract_start_date: string | null
          created_at: string
          email: string
          id: string
          monthly_value: number
          notes: string
          phone: string
          scope: string
          scope_demand_limits: string
          scope_included_services: string[]
          scope_monthly_deliverables: string[]
          scope_platforms: string[]
          scope_strategic_notes: string
          service_type: string[]
          status: string
          updated_at: string
        }
        Insert: {
          account_manager?: string
          company_name: string
          contact_name?: string
          contract_start_date?: string | null
          created_at?: string
          email?: string
          id?: string
          monthly_value?: number
          notes?: string
          phone?: string
          scope?: string
          scope_demand_limits?: string
          scope_included_services?: string[]
          scope_monthly_deliverables?: string[]
          scope_platforms?: string[]
          scope_strategic_notes?: string
          service_type?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          account_manager?: string
          company_name?: string
          contact_name?: string
          contract_start_date?: string | null
          created_at?: string
          email?: string
          id?: string
          monthly_value?: number
          notes?: string
          phone?: string
          scope?: string
          scope_demand_limits?: string
          scope_included_services?: string[]
          scope_monthly_deliverables?: string[]
          scope_platforms?: string[]
          scope_strategic_notes?: string
          service_type?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_editorial_lines: {
        Row: {
          audience: string | null
          client_id: string
          created_at: string
          id: string
          niche: string | null
          objective: string | null
          pillars: string[] | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          audience?: string | null
          client_id: string
          created_at?: string
          id?: string
          niche?: string | null
          objective?: string | null
          pillars?: string[] | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          audience?: string | null
          client_id?: string
          created_at?: string
          id?: string
          niche?: string | null
          objective?: string | null
          pillars?: string[] | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_editorial_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ideas: {
        Row: {
          client_id: string
          content_type: string | null
          created_at: string
          id: string
          objective: string | null
          pillar: string | null
          scheduled_date: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          content_type?: string | null
          created_at?: string
          id?: string
          objective?: string | null
          pillar?: string | null
          scheduled_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          content_type?: string | null
          created_at?: string
          id?: string
          objective?: string | null
          pillar?: string | null
          scheduled_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      content_scripts: {
        Row: {
          created_at: string
          cta: string | null
          development: string | null
          hook: string | null
          id: string
          idea_id: string | null
          observations: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta?: string | null
          development?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          observations?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta?: string | null
          development?: string | null
          hook?: string | null
          id?: string
          idea_id?: string | null
          observations?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_scripts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          accepted: boolean
          contract_id: string
          id: string
          ip_address: string
          signature_hash: string
          signed_at: string
          signer_cpf: string
          signer_email: string
          signer_name: string
          user_agent: string
        }
        Insert: {
          accepted?: boolean
          contract_id: string
          id?: string
          ip_address?: string
          signature_hash?: string
          signed_at?: string
          signer_cpf: string
          signer_email: string
          signer_name: string
          user_agent?: string
        }
        Update: {
          accepted?: boolean
          contract_id?: string
          id?: string
          ip_address?: string
          signature_hash?: string
          signed_at?: string
          signer_cpf?: string
          signer_email?: string
          signer_name?: string
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          additional_clauses: string
          affiliate_token: string | null
          client_address: string
          client_cpf_cnpj: string
          client_email: string
          client_id: string | null
          client_name: string
          contractor_address: string
          contractor_cpf_cnpj: string
          contractor_name: string
          created_at: string
          created_by: string | null
          deliverables: Json
          duration_months: number
          id: string
          monthly_value: number
          payment_due_day: number
          plan_name: string
          scope_description: string
          sent_at: string | null
          services: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          additional_clauses?: string
          affiliate_token?: string | null
          client_address?: string
          client_cpf_cnpj?: string
          client_email?: string
          client_id?: string | null
          client_name?: string
          contractor_address?: string
          contractor_cpf_cnpj?: string
          contractor_name?: string
          created_at?: string
          created_by?: string | null
          deliverables?: Json
          duration_months?: number
          id?: string
          monthly_value?: number
          payment_due_day?: number
          plan_name?: string
          scope_description?: string
          sent_at?: string | null
          services?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          additional_clauses?: string
          affiliate_token?: string | null
          client_address?: string
          client_cpf_cnpj?: string
          client_email?: string
          client_id?: string | null
          client_name?: string
          contractor_address?: string
          contractor_cpf_cnpj?: string
          contractor_name?: string
          created_at?: string
          created_by?: string | null
          deliverables?: Json
          duration_months?: number
          id?: string
          monthly_value?: number
          payment_due_day?: number
          plan_name?: string
          scope_description?: string
          sent_at?: string | null
          services?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostics: {
        Row: {
          client_id: string | null
          config: Json
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          slug: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          config?: Json
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          brand: string
          category: string
          condition: string
          created_at: string
          id: string
          model: string
          name: string
          notes: string
          serial_number: string
          status: string
          updated_at: string
        }
        Insert: {
          brand?: string
          category?: string
          condition?: string
          created_at?: string
          id?: string
          model?: string
          name: string
          notes?: string
          serial_number?: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand?: string
          category?: string
          condition?: string
          created_at?: string
          id?: string
          model?: string
          name?: string
          notes?: string
          serial_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          month_ref: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          month_ref?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          month_ref?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      gamification_settings: {
        Row: {
          id: number
          updated_at: string | null
          winning_prizes: Json
        }
        Insert: {
          id?: number
          updated_at?: string | null
          winning_prizes?: Json
        }
        Update: {
          id?: number
          updated_at?: string | null
          winning_prizes?: Json
        }
        Relationships: []
      }
      instagram_posts: {
        Row: {
          created_at: string
          id: string
          post_result: string
          post_url: string
          sort_order: number
          strategic_description: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_result?: string
          post_url: string
          sort_order?: number
          strategic_description?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_result?: string
          post_url?: string
          sort_order?: number
          strategic_description?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_contact: string
          client_name: string
          created_at: string
          created_by: string | null
          custom_message: string
          description: string
          due_date: string | null
          id: string
          is_recurring: boolean
          month_ref: string
          notes: string
          paid_at: string | null
          parent_invoice_id: string | null
          pix_code: string
          recurrence_day: number | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_contact?: string
          client_name: string
          created_at?: string
          created_by?: string | null
          custom_message?: string
          description?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          month_ref?: string
          notes?: string
          paid_at?: string | null
          parent_invoice_id?: string | null
          pix_code?: string
          recurrence_day?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_contact?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          custom_message?: string
          description?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          month_ref?: string
          notes?: string
          paid_at?: string | null
          parent_invoice_id?: string | null
          pix_code?: string
          recurrence_day?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_stages: {
        Row: {
          board: string
          color: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          board: string
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          board?: string
          color?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assignee: string
          company: string
          created_at: string
          email: string
          estimated_value: number
          id: string
          name: string
          notes: string
          phone: string
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          assignee?: string
          company?: string
          created_at?: string
          email?: string
          estimated_value?: number
          id?: string
          name: string
          notes?: string
          phone?: string
          source?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          company?: string
          created_at?: string
          email?: string
          estimated_value?: number
          id?: string
          name?: string
          notes?: string
          phone?: string
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      linktree_links: {
        Row: {
          active: boolean
          clicks: number
          created_at: string
          icon: string
          id: string
          linktree_id: string
          sort_order: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          clicks?: number
          created_at?: string
          icon?: string
          id?: string
          linktree_id: string
          sort_order?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          clicks?: number
          created_at?: string
          icon?: string
          id?: string
          linktree_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "linktree_links_linktree_fk"
            columns: ["linktree_id"]
            isOneToOne: false
            referencedRelation: "linktrees"
            referencedColumns: ["id"]
          },
        ]
      }
      linktrees: {
        Row: {
          avatar_emoji: string
          avatar_url: string | null
          bg_color: string
          bio: string
          border_color: string
          button_color: string
          button_style: string
          button_text_color: string
          client_id: string | null
          created_at: string
          display_name: string
          id: string
          slug: string
          text_color: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_emoji?: string
          avatar_url?: string | null
          bg_color?: string
          bio?: string
          border_color?: string
          button_color?: string
          button_style?: string
          button_text_color?: string
          client_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          slug: string
          text_color?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_emoji?: string
          avatar_url?: string | null
          bg_color?: string
          bio?: string
          border_color?: string
          button_color?: string
          button_style?: string
          button_text_color?: string
          client_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          slug?: string
          text_color?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          client_email: string
          client_name: string
          created_at: string
          created_by: string | null
          description: string
          duration_minutes: number
          google_event_id: string
          id: string
          meet_link: string
          meeting_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_email?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string
          duration_minutes?: number
          google_event_id?: string
          id?: string
          meet_link?: string
          meeting_date: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          client_email?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          description?: string
          duration_minutes?: number
          google_event_id?: string
          id?: string
          meet_link?: string
          meeting_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pix_settings: {
        Row: {
          city: string
          created_at: string
          id: string
          key_type: string
          pix_key: string
          receiver_name: string
          updated_at: string
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          key_type?: string
          pix_key?: string
          receiver_name?: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          key_type?: string
          pix_key?: string
          receiver_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_projects: {
        Row: {
          category: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string
          id: string
          order_index: number
          thumbnail_url: string
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          thumbnail_url?: string
          title: string
          updated_at?: string
          video_url?: string
        }
        Update: {
          category?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          thumbnail_url?: string
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          achievements: Json | null
          available_spins: number | null
          avatar_url: string | null
          created_at: string
          full_name: string
          gamification_metrics: Json | null
          id: string
          is_active: boolean
          job_title: string | null
          last_spin_date: string | null
          updated_at: string
          username: string | null
          won_prizes: Json | null
        }
        Insert: {
          achievements?: Json | null
          available_spins?: number | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gamification_metrics?: Json | null
          id: string
          is_active?: boolean
          job_title?: string | null
          last_spin_date?: string | null
          updated_at?: string
          username?: string | null
          won_prizes?: Json | null
        }
        Update: {
          achievements?: Json | null
          available_spins?: number | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gamification_metrics?: Json | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_spin_date?: string | null
          updated_at?: string
          username?: string | null
          won_prizes?: Json | null
        }
        Relationships: []
      }
      project_budgets: {
        Row: {
          charged_value: number
          client_id: string
          created_at: string
          id: string
          notes: string
          title: string
          updated_at: string
        }
        Insert: {
          charged_value?: number
          client_id: string
          created_at?: string
          id?: string
          notes?: string
          title?: string
          updated_at?: string
        }
        Update: {
          charged_value?: number
          client_id?: string
          created_at?: string
          id?: string
          notes?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          created_at: string
          id: string
          option_ids: string[]
          question_id: string
          response_id: string
          text_answer: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_ids?: string[]
          question_id: string
          response_id: string
          text_answer?: string
        }
        Update: {
          created_at?: string
          id?: string
          option_ids?: string[]
          question_id?: string
          response_id?: string
          text_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "quiz_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_clients: {
        Row: {
          company: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          notes: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          company?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name: string
          notes?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_options: {
        Row: {
          created_at: string
          id: string
          image_url: string
          order_index: number
          points: number
          question_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string
          order_index?: number
          points?: number
          question_id: string
          text?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          order_index?: number
          points?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          branching: Json
          config: Json
          created_at: string
          description: string
          id: string
          image_url: string
          next_question_id: string | null
          order_index: number
          quiz_id: string
          required: boolean
          title: string
          type: string
        }
        Insert: {
          branching?: Json
          config?: Json
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          next_question_id?: string | null
          order_index?: number
          quiz_id: string
          required?: boolean
          title?: string
          type: string
        }
        Update: {
          branching?: Json
          config?: Json
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          next_question_id?: string | null
          order_index?: number
          quiz_id?: string
          required?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          completed_at: string | null
          id: string
          lead_email: string
          lead_name: string
          lead_phone: string
          quiz_id: string
          started_at: string
          utm_campaign: string
          utm_medium: string
          utm_source: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lead_email?: string
          lead_name?: string
          lead_phone?: string
          quiz_id: string
          started_at?: string
          utm_campaign?: string
          utm_medium?: string
          utm_source?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          lead_email?: string
          lead_name?: string
          lead_phone?: string
          quiz_id?: string
          started_at?: string
          utm_campaign?: string
          utm_medium?: string
          utm_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          client_id: string
          completions_count: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          pixel_ga: string
          pixel_meta: string
          progress_bar: boolean
          redirect_delay_seconds: number
          redirect_url: string
          result_cta_label: string
          result_cta_url: string
          result_image_url: string
          result_text: string
          result_title: string
          score_enabled: boolean
          score_ranges: Json
          show_question_numbers: boolean
          slug: string
          starts_count: number
          status: string
          theme: Json
          updated_at: string
          views_count: number
          webhook_url: string
        }
        Insert: {
          client_id: string
          completions_count?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          pixel_ga?: string
          pixel_meta?: string
          progress_bar?: boolean
          redirect_delay_seconds?: number
          redirect_url?: string
          result_cta_label?: string
          result_cta_url?: string
          result_image_url?: string
          result_text?: string
          result_title?: string
          score_enabled?: boolean
          score_ranges?: Json
          show_question_numbers?: boolean
          slug: string
          starts_count?: number
          status?: string
          theme?: Json
          updated_at?: string
          views_count?: number
          webhook_url?: string
        }
        Update: {
          client_id?: string
          completions_count?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          pixel_ga?: string
          pixel_meta?: string
          progress_bar?: boolean
          redirect_delay_seconds?: number
          redirect_url?: string
          result_cta_label?: string
          result_cta_url?: string
          result_image_url?: string
          result_text?: string
          result_title?: string
          score_enabled?: boolean
          score_ranges?: Json
          show_question_numbers?: boolean
          slug?: string
          starts_count?: number
          status?: string
          theme?: Json
          updated_at?: string
          views_count?: number
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "quiz_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      rede_companies: {
        Row: {
          city: string
          created_at: string
          description: string
          id: string
          instagram: string
          is_active: boolean
          is_featured: boolean
          logo_url: string
          name: string
          niche: string
          owner_user_id: string | null
          services: string[]
          updated_at: string
          website: string
          whatsapp: string
        }
        Insert: {
          city?: string
          created_at?: string
          description?: string
          id?: string
          instagram?: string
          is_active?: boolean
          is_featured?: boolean
          logo_url?: string
          name: string
          niche?: string
          owner_user_id?: string | null
          services?: string[]
          updated_at?: string
          website?: string
          whatsapp?: string
        }
        Update: {
          city?: string
          created_at?: string
          description?: string
          id?: string
          instagram?: string
          is_active?: boolean
          is_featured?: boolean
          logo_url?: string
          name?: string
          niche?: string
          owner_user_id?: string | null
          services?: string[]
          updated_at?: string
          website?: string
          whatsapp?: string
        }
        Relationships: []
      }
      rede_post_comments: {
        Row: {
          author_avatar: string
          author_name: string
          author_user_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_avatar?: string
          author_name?: string
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_avatar?: string
          author_name?: string
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rede_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "rede_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rede_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rede_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "rede_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rede_posts: {
        Row: {
          author_user_id: string | null
          company_id: string
          content: string
          created_at: string
          id: string
          is_featured: boolean
          is_hidden: boolean
          media_type: string
          media_url: string
          post_type: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          company_id: string
          content?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          media_type?: string
          media_url?: string
          post_type?: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          media_type?: string
          media_url?: string
          post_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rede_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "rede_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clients: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          name: string
          token: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          token?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_tiers: {
        Row: {
          created_at: string
          id: string
          name: string
          prize_description: string
          required_count: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          prize_description?: string
          required_count?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          prize_description?: string
          required_count?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          client_id: string
          created_at: string
          id: string
          referred_name: string
          referred_whatsapp: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          referred_name: string
          referred_whatsapp?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          referred_name?: string
          referred_whatsapp?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "referral_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          activities: string[]
          created_at: string
          created_by: string | null
          custom_clauses: string
          id: string
          monthly_value: string
          provider_address: string
          provider_doc: string
          provider_name: string
          signature_hash: string | null
          signed_at: string | null
          signer_cpf: string | null
          signer_email: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          activities?: string[]
          created_at?: string
          created_by?: string | null
          custom_clauses?: string
          id?: string
          monthly_value?: string
          provider_address?: string
          provider_doc?: string
          provider_name?: string
          signature_hash?: string | null
          signed_at?: string | null
          signer_cpf?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          activities?: string[]
          created_at?: string
          created_by?: string | null
          custom_clauses?: string
          id?: string
          monthly_value?: string
          provider_address?: string
          provider_doc?: string
          provider_name?: string
          signature_hash?: string | null
          signed_at?: string | null
          signer_cpf?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shooting_schedules: {
        Row: {
          cast_notes: string
          client_id: string | null
          created_at: string
          end_time: string | null
          equipment_notes: string
          id: string
          location: string
          notes: string
          shooting_date: string
          start_time: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cast_notes?: string
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          equipment_notes?: string
          id?: string
          location?: string
          notes?: string
          shooting_date: string
          start_time?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cast_notes?: string
          client_id?: string | null
          created_at?: string
          end_time?: string | null
          equipment_notes?: string
          id?: string
          location?: string
          notes?: string
          shooting_date?: string
          start_time?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shooting_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shooting_schedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          label: string
          sort_order: number
          task_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          task_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
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
      task_stage_history: {
        Row: {
          changed_by: string
          created_at: string
          from_stage: string
          id: string
          task_id: string
          to_stage: string
        }
        Insert: {
          changed_by?: string
          created_at?: string
          from_stage?: string
          id?: string
          task_id: string
          to_stage: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_stage?: string
          id?: string
          task_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_stage_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee: string
          client_id: string | null
          copywriter: string
          created_at: string
          creative_direction: string
          current_stage_owner: string
          description: string
          director: string
          due_date: string | null
          editing_style: string
          editor: string
          editor_comments: string
          format: string
          full_script: string
          id: string
          observations: string
          platform: string
          post_date: string | null
          post_time: string | null
          priority: string
          recording_notes: string
          script_writer: string
          status: string
          strategic_notes: string
          task_type: string
          title: string
          updated_at: string
          video_idea: string
          video_name: string
          video_objective: string
          video_references: string
          video_url: string | null
          videomaker: string
        }
        Insert: {
          assignee?: string
          client_id?: string | null
          copywriter?: string
          created_at?: string
          creative_direction?: string
          current_stage_owner?: string
          description?: string
          director?: string
          due_date?: string | null
          editing_style?: string
          editor?: string
          editor_comments?: string
          format?: string
          full_script?: string
          id?: string
          observations?: string
          platform?: string
          post_date?: string | null
          post_time?: string | null
          priority?: string
          recording_notes?: string
          script_writer?: string
          status?: string
          strategic_notes?: string
          task_type?: string
          title: string
          updated_at?: string
          video_idea?: string
          video_name?: string
          video_objective?: string
          video_references?: string
          video_url?: string | null
          videomaker?: string
        }
        Update: {
          assignee?: string
          client_id?: string | null
          copywriter?: string
          created_at?: string
          creative_direction?: string
          current_stage_owner?: string
          description?: string
          director?: string
          due_date?: string | null
          editing_style?: string
          editor?: string
          editor_comments?: string
          format?: string
          full_script?: string
          id?: string
          observations?: string
          platform?: string
          post_date?: string | null
          post_time?: string | null
          priority?: string
          recording_notes?: string
          script_writer?: string
          status?: string
          strategic_notes?: string
          task_type?: string
          title?: string
          updated_at?: string
          video_idea?: string
          video_name?: string
          video_objective?: string
          video_references?: string
          video_url?: string | null
          videomaker?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          name: string
          permissions: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          name: string
          permissions?: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          permissions?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_client_access: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_access: {
        Row: {
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      user_page_access: {
        Row: {
          created_at: string
          id: string
          page_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
          user_id?: string
        }
        Relationships: []
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
      wa_conversations: {
        Row: {
          client_id: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          last_message: string
          last_message_at: string
          lead_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          contact_name?: string
          contact_phone: string
          created_at?: string
          id?: string
          last_message?: string
          last_message_at?: string
          lead_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          last_message?: string
          last_message_at?: string
          lead_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
          status: string
          template_name: string | null
          type: string
          wa_message_id: string | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          status?: string
          template_name?: string | null
          type?: string
          wa_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          status?: string
          template_name?: string | null
          type?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_sync_v1: {
        Row: {
          id: string
          qr_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          id: string
          qr_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          qr_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_templates: {
        Row: {
          body_text: string
          category: string
          created_at: string
          id: string
          language: string
          name: string
          status: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body_text?: string
          category?: string
          created_at?: string
          id?: string
          language?: string
          name: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_text?: string
          category?: string
          created_at?: string
          id?: string
          language?: string
          name?: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_monthly_affiliate_commissions: {
        Args: { _month?: string }
        Returns: number
      }
      get_contract_signature_minimal: {
        Args: { _contract_id: string }
        Returns: {
          signature_hash: string
          signed_at: string
          signer_name: string
        }[]
      }
      get_public_arte_tasks: {
        Args: never
        Returns: {
          assignee: string
          client_id: string
          client_name: string
          created_at: string
          description: string
          due_date: string
          id: string
          post_date: string
          post_time: string
          priority: string
          status: string
          title: string
        }[]
      }
      get_public_client_tasks: {
        Args: { _anchor: string }
        Returns: {
          assignee: string
          client_id: string | null
          copywriter: string
          created_at: string
          creative_direction: string
          current_stage_owner: string
          description: string
          director: string
          due_date: string | null
          editing_style: string
          editor: string
          editor_comments: string
          format: string
          full_script: string
          id: string
          observations: string
          platform: string
          post_date: string | null
          post_time: string | null
          priority: string
          recording_notes: string
          script_writer: string
          status: string
          strategic_notes: string
          task_type: string
          title: string
          updated_at: string
          video_idea: string
          video_name: string
          video_objective: string
          video_references: string
          video_url: string | null
          videomaker: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_contract: {
        Args: { _id: string }
        Returns: {
          additional_clauses: string
          affiliate_token: string | null
          client_address: string
          client_cpf_cnpj: string
          client_email: string
          client_id: string | null
          client_name: string
          contractor_address: string
          contractor_cpf_cnpj: string
          contractor_name: string
          created_at: string
          created_by: string | null
          deliverables: Json
          duration_months: number
          id: string
          monthly_value: number
          payment_due_day: number
          plan_name: string
          scope_description: string
          sent_at: string | null
          services: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_invoice: {
        Args: { _id: string }
        Returns: {
          amount: number
          client_contact: string
          client_name: string
          created_at: string
          created_by: string | null
          custom_message: string
          description: string
          due_date: string | null
          id: string
          is_recurring: boolean
          month_ref: string
          notes: string
          paid_at: string | null
          parent_invoice_id: string | null
          pix_code: string
          recurrence_day: number | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_pix_settings: {
        Args: never
        Returns: {
          city: string
          created_at: string
          id: string
          key_type: string
          pix_key: string
          receiver_name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pix_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_page_access: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_quiz_counter: {
        Args: { _field: string; _quiz_id: string }
        Returns: undefined
      }
      mark_contract_signed: { Args: { _id: string }; Returns: undefined }
      rename_kanban_stage: {
        Args: { _board: string; _new_name: string; _old_name: string }
        Returns: undefined
      }
      renew_recurring_invoices: { Args: never; Returns: number }
      update_public_task_status: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_module: "comercial" | "operacional"
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
      app_module: ["comercial", "operacional"],
      app_role: ["admin", "user"],
    },
  },
} as const
