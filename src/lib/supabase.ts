import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nmtwtgnmngsbvolhhdpb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tdHd0Z25tbmdzYnZvbGhoZHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDM0MDQsImV4cCI6MjA4NTk3OTQwNH0.0-f0UODtNInHxJCJi3sutSIUA8Yh4IZVqGohm9bfc6M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface BankCard {
  id: number
  card_number: string
  balance: number
  created_at: string
}

export interface DepositRequest {
  id: number
  card_number: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_at: string | null
}

export interface TransferRule {
  id: number
  card_number: string
  daily_deposit: number
  daily_deduction: number
  is_active: boolean
  created_at: string
}
