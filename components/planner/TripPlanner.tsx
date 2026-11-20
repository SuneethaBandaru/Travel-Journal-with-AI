'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PlannerAgent, PlannerEvent, PlanResult } from '@/lib/ai/types'

type Step = {
  key: string
  agent: PlannerAgent
  iteration?: number
  status: 'running' | 'done'
  ms?: number
  output?: Record<string, unknown>
}

const AGENTS: Record<PlannerAgent, { icon: string; title: string; working: string }> = {
  researcher: { icon: '🔎', title: 'Researcher', working: 'Reading community trip stories…' },
  planner: { icon: '🗺️', title: 'Planner', working: 'Building your day-by-day itinerary…' },
  factchecker: { icon: '✅', title: 'Fact-checker', working: 'Checking every idea against its source…' },
}

function stepSummary(s: Step) {
  const o = s.output
  if (!o) return ''
  if (s.agent === 'researcher') {
    const posts = (o.relevantPosts as unknown[])?.length ?? 0
    const tips = (o.insights as unknown[])?.length ?? 0
    return `Found ${posts} relevant stories · ${tips} tips · coverage: ${o.coverage}`
  }
  if (s.agent === 'planner') return `${(o.days as unknown[])?.length ?? 0}-day plan drafted: “${o.title}”`
  return `${o.approved ? 'Approved' : 'Rejected – sent back to Planner'} · score ${o.score}/10`
}

export default function TripPlanner() {
  const [destination, setDestination] = useState('')
  const [days, setDays] = useState(3)
  const [interests, setInterests] = useState('')
  const [budget, setBudget] = useState('mid-range')
  const [steps, setSteps] = useState<Step[]>([])
  const [result, setResult] = useState<PlanResult | null>(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  function onEvent(e: PlannerEvent) {
    if (e.type === 'agent_start') {
      setSteps((s) => [...s, { key: `${e.agent}-${e.iteration ?? 1}`, agent: e.agent, iteration: e.iteration, status: 'running' }])
    } else if (e.type === 'agent_done') {
      setSteps((s) =>
        s.map((st) =>
          st.key === `${e.agent}-${e.iteration ?? 1}`
            ? { ...st, status: 'done', ms: e.ms, output: e.output as Record<string, unknown> }
            : st
        )
      )
    } else if (e.type === 'complete') {
      setResult(e.result)
    } else if (e.type === 'error') {
      setError(e.message)
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setRunning(true)
    setSteps([])
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, days, interests, budget }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) if (line.trim()) onEvent(JSON.parse(line))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRunning(false)
    }
  }

  const titleBySlug = new Map(result?.sources.map((s) => [s.slug, s.title]) ?? [])
  const finalCheck = result?.checks[result.checks.length - 1]

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-[#D3D1C7] bg-white p-5">
          <label className="block text-sm">
            <span className="font-semibold text-[#2B2B2B]">Where do you want to go?</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Japan, Spain, Italy"
              required
              className="mt-1 w-full rounded-lg border border-[#8A8580] px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold text-[#2B2B2B]">Days</span>
              <input
                type="number"
                min={1}
                max={10}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[#8A8580] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-[#2B2B2B]">Budget</span>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#8A8580] bg-white px-3 py-2"
              >
                <option value="budget">Budget</option>
                <option value="mid-range">Mid-range</option>
                <option value="luxury">Luxury</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-semibold text-[#2B2B2B]">Interests</span>
            <input
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="food, hiking, museums, beaches…"
              className="mt-1 w-full rounded-lg border border-[#8A8580] px-3 py-2"
            />
          </label>
          <button
            disabled={running}
            className="w-full rounded-full bg-[#E8914B] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {running ? 'Agents are planning…' : 'Plan my trip'}
          </button>
        </form>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8A8580]">Agent team</h2>
          {steps.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#D3D1C7] p-4 text-sm text-[#5F5E5A]">
              🔎 Researcher → 🗺️ Planner ⇄ ✅ Fact-checker
              <br />
              <span className="text-xs text-[#8A8580]">
                The Fact-checker sends the plan back to the Planner until every idea is backed by a real story.
              </span>
            </p>
          ) : (
            <ol className="space-y-2">
              {steps.map((s) => (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${
                    s.status === 'running' ? 'border-[#E8914B]' : 'border-[#D3D1C7]'
                  }`}
                >
                  <span className="text-lg">{AGENTS[s.agent].icon}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-[#2B2B2B]">
                      {AGENTS[s.agent].title}
                      {(s.iteration ?? 1) > 1 && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          revision {s.iteration! - 1}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#5F5E5A]">{s.status === 'running' ? AGENTS[s.agent].working : stepSummary(s)}</p>
                  </div>
                  <span className="text-xs text-[#8A8580]">
                    {s.status === 'running' ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#E8914B] border-t-transparent" />
                    ) : (
                      `${((s.ms ?? 0) / 1000).toFixed(1)}s`
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">⚠️ {error}</p>}
      </div>

      <div>
        {!result ? (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-[#D3D1C7] p-8 text-center text-sm text-[#8A8580]">
            {running ? 'Your plan is being written and fact-checked…' : 'Your itinerary will appear here.'}
          </div>
        ) : (
          <article className="space-y-5 rounded-xl border border-[#D3D1C7] bg-white p-6">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-[#2B2B2B]">{result.itinerary.title}</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">{result.itinerary.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[#2D6A6A]/10 px-3 py-1 font-semibold text-[#2D6A6A]">
                  Based on {result.sources.length} community {result.sources.length === 1 ? 'story' : 'stories'}
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                  Fact-check {finalCheck?.score}/10 {finalCheck?.approved ? '✓' : '(needs care)'}
                </span>
                <span className="rounded-full bg-[#FAF7F2] px-3 py-1 text-[#5F5E5A]">
                  {result.revisions} revision{result.revisions === 1 ? '' : 's'} · {(result.totalMs / 1000).toFixed(0)}s
                </span>
              </div>
              {result.research.coverage !== 'good' && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Our community hasn&apos;t written much about {result.request.destination} yet, so parts of this plan are
                  general suggestions. Been there? <Link href="/posts/new" className="font-semibold underline">Share your trip</Link>.
                </p>
              )}
            </div>

            <ol className="space-y-4">
              {result.itinerary.days.map((d) => (
                <li key={d.day} className="rounded-xl bg-[#FAF7F2] p-4">
                  <h3 className="font-serif font-semibold text-[#2B2B2B]">
                    Day {d.day} · {d.title}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {d.activities.map((a, i) => (
                      <li key={i} className="text-sm text-[#2B2B2B]">
                        <span className="font-semibold text-[#E8914B]">{a.time}:</span> {a.activity}
                        {a.sourceSlug && titleBySlug.has(a.sourceSlug) ? (
                          <Link href={`/posts/${a.sourceSlug}`} className="ml-1 text-xs font-semibold text-[#2D6A6A] underline">
                            📖 {titleBySlug.get(a.sourceSlug)}
                          </Link>
                        ) : (
                          <span className="ml-1 text-xs text-[#8A8580]">(general suggestion)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>

            {result.itinerary.tips?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8A8580]">Practical tips</h3>
                <ul className="ml-5 list-disc space-y-1 text-sm text-[#2B2B2B]">
                  {result.itinerary.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.sources.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8A8580]">Read the stories behind this plan</h3>
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/posts/${s.slug}`}
                      className="rounded-full border border-[#2D6A6A] px-3 py-1 text-xs font-semibold text-[#2D6A6A] hover:bg-[#2D6A6A] hover:text-white"
                    >
                      {s.title} · {s.country}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-[#2B2B2B]">Fact-check history ({result.checks.length})</summary>
              <ol className="mt-2 space-y-2">
                {result.checks.map((c, i) => (
                  <li key={i} className="rounded-lg bg-[#FAF7F2] p-3 text-xs text-[#5F5E5A]">
                    <p className="font-semibold text-[#2B2B2B]">
                      Round {i + 1}: {c.approved ? '✅ approved' : '❌ rejected'} ({c.score}/10)
                    </p>
                    {c.issues.length > 0 && (
                      <ul className="ml-4 list-disc">
                        {c.issues.map((issue, j) => (
                          <li key={j}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1">{c.feedback}</p>
                  </li>
                ))}
              </ol>
            </details>
          </article>
        )}
      </div>
    </div>
  )
}
