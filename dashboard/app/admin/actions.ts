'use server'
import { adminClient } from '@/lib/supabase-admin'
import { getServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Unauthorized')
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') throw new Error('MFA required')
  return user
}

async function writeAuditLog(opts: {
  actor: string
  action: string
  entity_type?: string
  entity_id?: string
  metadata?: Record<string, unknown>
}) {
  await adminClient.from('audit_log').insert({
    business_id: null,
    actor: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type ?? null,
    entity_id: opts.entity_id ?? null,
    metadata: opts.metadata ?? null,
  })
}

export async function deleteBusinessAction(businessId: string): Promise<void> {
  const admin = await requireAdmin()

  // Fetch business name before deletion for the audit trail
  const { data: biz } = await adminClient
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .maybeSingle()

  const { error } = await adminClient.from('businesses').delete().eq('id', businessId)
  if (error) throw new Error(error.message)

  await writeAuditLog({
    actor: admin.id,
    action: 'admin.business.deleted',
    entity_type: 'business',
    entity_id: businessId,
    metadata: { business_name: biz?.name ?? null, deleted_by_email: admin.email },
  })

  revalidatePath('/admin')
}

export async function getImpersonateLinkAction(targetEmail: string): Promise<string> {
  const admin = await requireAdmin()

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link = (data as any)?.properties?.action_link
  if (!link) throw new Error('No action_link returned')

  await writeAuditLog({
    actor: admin.id,
    action: 'admin.user.impersonated',
    entity_type: 'user',
    metadata: { target_email: targetEmail, initiated_by_email: admin.email },
  })

  return link as string
}
