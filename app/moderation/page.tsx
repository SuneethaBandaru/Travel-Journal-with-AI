import Link from 'next/link'
import Header from '@/components/Header'
import { createClient } from '@/lib/supabase/server'
import { timeAgo } from '@/lib/format'

export const metadata = { title: 'AI moderation log · Travel Journal' }

// Estimated seconds a human moderator spends reviewing one comment (for the time-saved metric)
const SECONDS_PER_MANUAL_REVIEW = 30

type ModRow = {
  id: string
  content: string
  created_at: string
  user_id: string
  moderation_status: 'approved' | 'hidden'
  moderation_category: string | null
  moderation_reason: string | null
  moderated_by: string | null
  posts: { title: string; slug: string; user_id: string } | null
}

export default async function ModerationPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims?.sub ?? null

  const { data, error } = await supabase
    .from('comments')
    .select('id, content, created_at, user_id, moderation_status, moderation_category, moderation_reason, moderated_by, posts(title, slug, user_id)')
    .not('moderated_by', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (data ?? []) as unknown as ModRow[]
  const total = rows.length
  const hidden = rows.filter((r) => r.moderation_status === 'hidden')
  const escalated = rows.filter((r) => r.moderated_by === 'reviewer').length
  const byCategory = hidden.reduce<Record<string, number>>((acc, r) => {
    const k = r.moderation_category ?? 'other'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const minutesSaved = Math.round((total * SECONDS_PER_MANUAL_REVIEW) / 60)

  const stats = [
    { label: 'Comments checked', value: total },
    { label: 'Hidden automatically', value: hidden.length },
    { label: 'Hidden rate', value: total ? `${Math.round((hidden.length / total) * 100)}%` : '–' },
    { label: 'Escalated to Reviewer', value: escalated },
    { label: 'Moderator time saved', value: `${minutesSaved} min` },
  ]

  return (
    <div className="flex-1 bg-[#FAF7F2]">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-serif text-2xl font-semibold text-[#2B2B2B]">🛡️ AI moderation log</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5F5E5A]">
          Every new comment is checked by the <b>Moderator agent</b>. Clear cases are decided instantly; borderline
          cases are escalated to the <b>Reviewer agent</b> for a second opinion. Hidden comments stay visible to their
          author and the post owner, with the reason.
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Moderation is not set up in the database yet.</p>
            <p className="mt-1">
              Open Supabase → SQL Editor, paste the contents of <code>supabase/ai-moderation.sql</code> and click Run.
            </p>
            <p className="mt-2 text-xs opacity-70">Details: {error.message}</p>
          </div>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-[#D3D1C7] bg-white p-3">
                  <p className="text-xs text-[#8A8580]">{s.label}</p>
                  <p className="text-xl font-semibold text-[#2B2B2B]">{s.value}</p>
                </div>
              ))}
            </section>

            {Object.keys(byCategory).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {Object.entries(byCategory).map(([cat, n]) => (
                  <span key={cat} className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-800">
                    {cat.replace('_', ' ')}: {n}
                  </span>
                ))}
              </div>
            )}

            <section className="mt-6 overflow-x-auto rounded-xl border border-[#D3D1C7] bg-white">
              {rows.length === 0 ? (
                <p className="p-6 text-sm text-[#8A8580]">No comments have been moderated yet. Write a comment on any post to try it.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-[#8A8580]">
                    <tr className="border-b border-[#D3D1C7]">
                      <th className="px-4 py-2">When</th>
                      <th className="px-4 py-2">Post</th>
                      <th className="px-4 py-2">Comment</th>
                      <th className="px-4 py-2">Decision</th>
                      <th className="px-4 py-2">Decided by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isHidden = r.moderation_status === 'hidden'
                      // Content of hidden comments is only shown to the comment author and post owner
                      const canSee = !isHidden || r.user_id === userId || r.posts?.user_id === userId
                      return (
                        <tr key={r.id} className="border-b border-[#F0EEE9] align-top">
                          <td className="whitespace-nowrap px-4 py-2 text-xs text-[#8A8580]">{timeAgo(r.created_at)}</td>
                          <td className="px-4 py-2">
                            {r.posts ? (
                              <Link href={`/posts/${r.posts.slug}`} className="text-[#2D6A6A] underline">
                                {r.posts.title}
                              </Link>
                            ) : (
                              '–'
                            )}
                          </td>
                          <td className="max-w-xs px-4 py-2 text-[#2B2B2B]">
                            {canSee ? r.content : <span className="italic text-[#8A8580]">(hidden content)</span>}
                          </td>
                          <td className="px-4 py-2">
                            {isHidden ? (
                              <span className="font-semibold text-red-700">
                                Hidden · {r.moderation_category?.replace('_', ' ')}
                              </span>
                            ) : (
                              <span className="font-semibold text-emerald-700">Approved</span>
                            )}
                            {r.moderation_reason && <p className="text-xs text-[#5F5E5A]">{r.moderation_reason}</p>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-xs text-[#5F5E5A]">
                            {r.moderated_by === 'reviewer' ? '🧑‍⚖️ Reviewer' : r.moderated_by === 'moderator' ? '🛡️ Moderator' : '⚙️ Fallback'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
