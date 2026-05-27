import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'`,
  })

  if (error) {
    // Fallback: try direct SQL via pg_graphql
    const { error: err2 } = await supabase.from('_sql').insert({
      query: `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'`,
    }).maybeSingle()

    if (err2) {
      return NextResponse.json({ error: err2.message }, { status: 500 })
    }
  }

  // Refresh schema cache by calling the PostgREST schema endpoint
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'GET',
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  })

  return NextResponse.json({ success: true })
}