import Header from '@/components/Header'
import TripPlanner from '@/components/planner/TripPlanner'

export const metadata = { title: 'AI Trip Planner · Travel Journal' }

export default function PlannerPage() {
  return (
    <div className="flex-1 bg-[#FAF7F2]">
      <Header />
      <section className="bg-linear-to-b from-[#F6E3D0] to-[#FAF7F2]">
        <div className="mx-auto max-w-5xl px-6 py-10 text-center">
          <h1 className="font-serif text-3xl font-semibold text-[#2B2B2B] sm:text-4xl">✨ AI Trip Planner</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[#5F5E5A]">
            A team of AI agents reads real trip stories from our community and turns them into a day-by-day plan,
            with links to the stories every idea came from.
          </p>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-6 pb-12">
        <TripPlanner />
      </main>
    </div>
  )
}
