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
}

export async function deleteBusinessAction(businessId: string): Promise<void> {
  await requireAdmin()
  const { error } = await adminClient.from('businesses').delete().eq('id', businessId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function getImpersonateLinkAction(email: string): Promise<string> {
  await requireAdmin()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link = (data as any)?.properties?.action_link
  if (!link) throw new Error('No action_link returned')
  return link as string
}
