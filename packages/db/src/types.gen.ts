
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "fotoai_agent_actions": {
                  Row: {
                    "action_type": string,"details": NonNullable<Json>,"error_message": string | null,"executed_at": string,"id": string,"legacy_appwrite_id": string | null,"success": boolean,"user_id": string
                  }
                  Insert: {
                    "action_type": string,"details"?: NonNullable<Json>,"error_message"?: string | null,"executed_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"success"?: boolean,"user_id": string
                  }
                  Update: {
                    "action_type"?: string,"details"?: NonNullable<Json>,"error_message"?: string | null,"executed_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"success"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_challenge_submissions": {
                  Row: {
                    "challenge_id": string,"created_at": string,"feedback": string | null,"feedback_status": string,"id": string,"legacy_appwrite_id": string | null,"notes": string,"photo_bytes": number | null,"photo_mime": string | null,"photo_object_key": string | null,"rating": number | null,"submitted_at": string,"user_id": string
                  }
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"feedback"?: string | null,"feedback_status"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"notes"?: string,"photo_bytes"?: number | null,"photo_mime"?: string | null,"photo_object_key"?: string | null,"rating"?: number | null,"submitted_at"?: string,"user_id": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"feedback"?: string | null,"feedback_status"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"notes"?: string,"photo_bytes"?: number | null,"photo_mime"?: string | null,"photo_object_key"?: string | null,"rating"?: number | null,"submitted_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fotoai_challenge_submissions_challenge_owner_fkey"
      columns: ["challenge_id","user_id"]
isOneToOne: false
      referencedRelation: "fotoai_daily_challenges"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"fotoai_daily_challenges": {
                  Row: {
                    "category": string | null,"challenge_text": string,"challenge_type": string,"completed_date": string | null,"created_at": string,"difficulty": string | null,"duration": string | null,"editing_direction": string | null,"id": string,"issued_date": string,"legacy_appwrite_id": string | null,"location": string | null,"mastery_area": string | null,"narrative_context": string | null,"recommended_gear": (string)[],"shot_list": (string)[],"source": string,"status": string,"success_criteria": string | null,"technical_level": number | null,"tips": string | null,"user_id": string,"weather_conditions": string | null,"what_to_look_for": string | null
                  }
                  Insert: {
                    "category"?: string | null,"challenge_text": string,"challenge_type": string,"completed_date"?: string | null,"created_at"?: string,"difficulty"?: string | null,"duration"?: string | null,"editing_direction"?: string | null,"id"?: string,"issued_date"?: string,"legacy_appwrite_id"?: string | null,"location"?: string | null,"mastery_area"?: string | null,"narrative_context"?: string | null,"recommended_gear"?: (string)[],"shot_list"?: (string)[],"source"?: string,"status"?: string,"success_criteria"?: string | null,"technical_level"?: number | null,"tips"?: string | null,"user_id": string,"weather_conditions"?: string | null,"what_to_look_for"?: string | null
                  }
                  Update: {
                    "category"?: string | null,"challenge_text"?: string,"challenge_type"?: string,"completed_date"?: string | null,"created_at"?: string,"difficulty"?: string | null,"duration"?: string | null,"editing_direction"?: string | null,"id"?: string,"issued_date"?: string,"legacy_appwrite_id"?: string | null,"location"?: string | null,"mastery_area"?: string | null,"narrative_context"?: string | null,"recommended_gear"?: (string)[],"shot_list"?: (string)[],"source"?: string,"status"?: string,"success_criteria"?: string | null,"technical_level"?: number | null,"tips"?: string | null,"user_id"?: string,"weather_conditions"?: string | null,"what_to_look_for"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_editing_recipes": {
                  Row: {
                    "analysis_date": string,"created_at": string,"edited_photo_object_key": string | null,"id": string,"legacy_appwrite_id": string | null,"original_photo_object_key": string | null,"recipe": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "analysis_date"?: string,"created_at"?: string,"edited_photo_object_key"?: string | null,"id"?: string,"legacy_appwrite_id"?: string | null,"original_photo_object_key"?: string | null,"recipe"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "analysis_date"?: string,"created_at"?: string,"edited_photo_object_key"?: string | null,"id"?: string,"legacy_appwrite_id"?: string | null,"original_photo_object_key"?: string | null,"recipe"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_itineraries": {
                  Row: {
                    "completed_date": string | null,"created_at": string,"description": string | null,"duration": string | null,"gear_recommendations": (string)[],"generated_date": string,"id": string,"legacy_appwrite_id": string | null,"location": string,"scheduled_date": string | null,"spots": NonNullable<Json>,"status": string,"suggested_times": (string)[],"title": string | null,"user_id": string,"weather_conditions": string | null
                  }
                  Insert: {
                    "completed_date"?: string | null,"created_at"?: string,"description"?: string | null,"duration"?: string | null,"gear_recommendations"?: (string)[],"generated_date"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"location": string,"scheduled_date"?: string | null,"spots"?: NonNullable<Json>,"status"?: string,"suggested_times"?: (string)[],"title"?: string | null,"user_id": string,"weather_conditions"?: string | null
                  }
                  Update: {
                    "completed_date"?: string | null,"created_at"?: string,"description"?: string | null,"duration"?: string | null,"gear_recommendations"?: (string)[],"generated_date"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"location"?: string,"scheduled_date"?: string | null,"spots"?: NonNullable<Json>,"status"?: string,"suggested_times"?: (string)[],"title"?: string | null,"user_id"?: string,"weather_conditions"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_photo_critiques": {
                  Row: {
                    "composition_feedback": string | null,"composition_score": number | null,"created_at": string,"creative_feedback": string | null,"creative_score": number | null,"critique_date": string,"id": string,"improvements": (string)[],"legacy_appwrite_id": string | null,"overall_score": number | null,"photo_object_key": string,"strengths": (string)[],"submission_id": string | null,"suggested_settings": string | null,"technical_feedback": string | null,"technical_score": number | null,"user_id": string
                  }
                  Insert: {
                    "composition_feedback"?: string | null,"composition_score"?: number | null,"created_at"?: string,"creative_feedback"?: string | null,"creative_score"?: number | null,"critique_date"?: string,"id"?: string,"improvements"?: (string)[],"legacy_appwrite_id"?: string | null,"overall_score"?: number | null,"photo_object_key": string,"strengths"?: (string)[],"submission_id"?: string | null,"suggested_settings"?: string | null,"technical_feedback"?: string | null,"technical_score"?: number | null,"user_id": string
                  }
                  Update: {
                    "composition_feedback"?: string | null,"composition_score"?: number | null,"created_at"?: string,"creative_feedback"?: string | null,"creative_score"?: number | null,"critique_date"?: string,"id"?: string,"improvements"?: (string)[],"legacy_appwrite_id"?: string | null,"overall_score"?: number | null,"photo_object_key"?: string,"strengths"?: (string)[],"submission_id"?: string | null,"suggested_settings"?: string | null,"technical_feedback"?: string | null,"technical_score"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fotoai_photo_critiques_submission_owner_fkey"
      columns: ["submission_id","user_id"]
isOneToOne: false
      referencedRelation: "fotoai_challenge_submissions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"fotoai_portfolio_analyses": {
                  Row: {
                    "analysis": NonNullable<Json>,"analysis_date": string,"created_at": string,"id": string,"legacy_appwrite_id": string | null,"photo_count": number,"user_id": string
                  }
                  Insert: {
                    "analysis"?: NonNullable<Json>,"analysis_date"?: string,"created_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"photo_count": number,"user_id": string
                  }
                  Update: {
                    "analysis"?: NonNullable<Json>,"analysis_date"?: string,"created_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"photo_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_reverse_analyses": {
                  Row: {
                    "analysis_date": string,"created_at": string,"id": string,"legacy_appwrite_id": string | null,"photo_object_key": string,"result": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "analysis_date"?: string,"created_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"photo_object_key": string,"result"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "analysis_date"?: string,"created_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"photo_object_key"?: string,"result"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_user_gear": {
                  Row: {
                    "brand": string,"category": string,"created_at": string,"id": string,"is_primary": boolean,"legacy_appwrite_id": string | null,"model": string,"specs": string | null,"user_id": string
                  }
                  Insert: {
                    "brand": string,"category": string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"legacy_appwrite_id"?: string | null,"model": string,"specs"?: string | null,"user_id": string
                  }
                  Update: {
                    "brand"?: string,"category"?: string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"legacy_appwrite_id"?: string | null,"model"?: string,"specs"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_user_preferences": {
                  Row: {
                    "adapt_to_calendar": boolean,"adapt_to_weather": boolean,"avoids_styles": (string)[],"created_at": string,"current_location": string | null,"evening_photography": boolean,"home_location": string | null,"id": string,"legacy_appwrite_id": string | null,"lunch_break_photography": boolean,"lunch_end_time": string,"lunch_start_time": string,"office_location": string | null,"photography_interests": (string)[],"primary_photo_day": string,"secondary_photo_days": (string)[],"skill_level": string,"updated_at": string | null,"user_id": string,"wfh_flexibility": boolean,"work_days": (string)[],"work_end_time": string,"work_start_time": string
                  }
                  Insert: {
                    "adapt_to_calendar"?: boolean,"adapt_to_weather"?: boolean,"avoids_styles"?: (string)[],"created_at"?: string,"current_location"?: string | null,"evening_photography"?: boolean,"home_location"?: string | null,"id"?: string,"legacy_appwrite_id"?: string | null,"lunch_break_photography"?: boolean,"lunch_end_time"?: string,"lunch_start_time"?: string,"office_location"?: string | null,"photography_interests"?: (string)[],"primary_photo_day"?: string,"secondary_photo_days"?: (string)[],"skill_level"?: string,"updated_at"?: string | null,"user_id": string,"wfh_flexibility"?: boolean,"work_days"?: (string)[],"work_end_time"?: string,"work_start_time"?: string
                  }
                  Update: {
                    "adapt_to_calendar"?: boolean,"adapt_to_weather"?: boolean,"avoids_styles"?: (string)[],"created_at"?: string,"current_location"?: string | null,"evening_photography"?: boolean,"home_location"?: string | null,"id"?: string,"legacy_appwrite_id"?: string | null,"lunch_break_photography"?: boolean,"lunch_end_time"?: string,"lunch_start_time"?: string,"office_location"?: string | null,"photography_interests"?: (string)[],"primary_photo_day"?: string,"secondary_photo_days"?: (string)[],"skill_level"?: string,"updated_at"?: string | null,"user_id"?: string,"wfh_flexibility"?: boolean,"work_days"?: (string)[],"work_end_time"?: string,"work_start_time"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_user_progress": {
                  Row: {
                    "after_work_completed": number,"after_work_issued": number,"created_at": string,"current_streak": number,"favorite_subjects": (string)[],"id": string,"improvement_areas": (string)[],"last_challenge_date": string | null,"last_completion_date": string | null,"last_streak_update": string | null,"legacy_appwrite_id": string | null,"longest_streak": number,"lunch_break_completed": number,"lunch_break_issued": number,"saturday_challenges_completed": number,"saturday_challenges_issued": number,"total_challenges_completed": number,"total_challenges_issued": number,"updated_at": string | null,"user_id": string,"wfh_completed": number,"wfh_issued": number
                  }
                  Insert: {
                    "after_work_completed"?: number,"after_work_issued"?: number,"created_at"?: string,"current_streak"?: number,"favorite_subjects"?: (string)[],"id"?: string,"improvement_areas"?: (string)[],"last_challenge_date"?: string | null,"last_completion_date"?: string | null,"last_streak_update"?: string | null,"legacy_appwrite_id"?: string | null,"longest_streak"?: number,"lunch_break_completed"?: number,"lunch_break_issued"?: number,"saturday_challenges_completed"?: number,"saturday_challenges_issued"?: number,"total_challenges_completed"?: number,"total_challenges_issued"?: number,"updated_at"?: string | null,"user_id": string,"wfh_completed"?: number,"wfh_issued"?: number
                  }
                  Update: {
                    "after_work_completed"?: number,"after_work_issued"?: number,"created_at"?: string,"current_streak"?: number,"favorite_subjects"?: (string)[],"id"?: string,"improvement_areas"?: (string)[],"last_challenge_date"?: string | null,"last_completion_date"?: string | null,"last_streak_update"?: string | null,"legacy_appwrite_id"?: string | null,"longest_streak"?: number,"lunch_break_completed"?: number,"lunch_break_issued"?: number,"saturday_challenges_completed"?: number,"saturday_challenges_issued"?: number,"total_challenges_completed"?: number,"total_challenges_issued"?: number,"updated_at"?: string | null,"user_id"?: string,"wfh_completed"?: number,"wfh_issued"?: number
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_user_skills": {
                  Row: {
                    "created_at": string,"current_xp": number,"id": string,"last_xp_date": string | null,"legacy_appwrite_id": string | null,"skill_id": string,"status": string,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"current_xp"?: number,"id"?: string,"last_xp_date"?: string | null,"legacy_appwrite_id"?: string | null,"skill_id": string,"status"?: string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"current_xp"?: number,"id"?: string,"last_xp_date"?: string | null,"legacy_appwrite_id"?: string | null,"skill_id"?: string,"status"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_weekly_reports": {
                  Row: {
                    "created_at": string,"id": string,"insights": NonNullable<Json>,"legacy_appwrite_id": string | null,"report_date": string,"stats": NonNullable<Json>,"user_id": string,"week_end": string,"week_start": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"insights"?: NonNullable<Json>,"legacy_appwrite_id"?: string | null,"report_date"?: string,"stats"?: NonNullable<Json>,"user_id": string,"week_end": string,"week_start": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"insights"?: NonNullable<Json>,"legacy_appwrite_id"?: string | null,"report_date"?: string,"stats"?: NonNullable<Json>,"user_id"?: string,"week_end"?: string,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fotoai_xp_events": {
                  Row: {
                    "awarded_at": string,"created_at": string,"id": string,"legacy_appwrite_id": string | null,"skill_id": string,"source_id": string | null,"source_kind": string,"user_id": string,"xp_amount": number
                  }
                  Insert: {
                    "awarded_at"?: string,"created_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"skill_id": string,"source_id"?: string | null,"source_kind": string,"user_id": string,"xp_amount": number
                  }
                  Update: {
                    "awarded_at"?: string,"created_at"?: string,"id"?: string,"legacy_appwrite_id"?: string | null,"skill_id"?: string,"source_id"?: string | null,"source_kind"?: string,"user_id"?: string,"xp_amount"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "fotoai_award_skill_xp":
{ Args: { "p_prerequisite_skills": (string)[],"p_skill_id": string,"p_source_id": string,"p_source_kind": string,"p_user_id": string,"p_xp_amount": number,"p_xp_to_learn": number,"p_xp_to_master": number,"p_xp_to_practice": number }; Returns: Database["public"]['CompositeTypes']["fotoai_xp_award_result"]
                          SetofOptions: {
        from: "*"
        to: "fotoai_xp_award_result"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "fotoai_xp_award_result": {
                        "outcome": string | null,"event_id": string | null,"skill_id": string | null,"xp_awarded": number | null,"current_xp": number | null,"status": string | null,"leveled_up": boolean | null
                      }
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

