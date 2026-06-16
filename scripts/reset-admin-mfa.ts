import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function main() {
  if (process.env.RESET_MFA !== '1') {
    throw new Error('Safety guard: set RESET_MFA=1 to run this script.')
  }
  const email = process.env.ADMIN_EMAIL
  if (!email) throw new Error('ADMIN_EMAIL not set')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error

  const user = data.users.find((u) => u.email === email)
  if (!user) throw new Error(`Admin user not found for email: ${email}`)

  const factors = (user.factors ?? []).filter((f) => f.factor_type === 'totp')
  if (factors.length === 0) {
    console.log('No TOTP factors found — nothing to clear.')
    return
  }

  for (const f of factors) {
    await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id })
    console.log(`Deleted factor ${f.id} (${f.friendly_name ?? 'unnamed'})`)
  }

  console.log('✓ MFA reset — sign in and you will be redirected to /admin/enroll.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
