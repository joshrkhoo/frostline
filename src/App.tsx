import { useState } from 'react'
import { BoardDetail } from './components/BoardDetail'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Marketplace } from './components/Marketplace'
import { Footer, StoresSection } from './components/StoresSection'
import { useMarket } from './lib/data'
import { DEFAULT_FILTERS, type Filters } from './lib/filters'
import { useRoute } from './lib/router'

export default function App() {
  const { data, error } = useMarket()
  const route = useRoute()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const setQuery = (query: string) => setFilters((f) => ({ ...f, query }))
  const pickStore = (id: string) => {
    setFilters({ ...DEFAULT_FILTERS, stores: [id] })
    document.getElementById('market')?.scrollIntoView({ behavior: 'smooth' })
  }

  let body: React.ReactNode
  if (error) body = <Status title="Couldn't load the market" text={error} />
  else if (!data) body = <Status title="Loading the market…" text="Fetching the latest snowboard prices." />
  else if (route.page === 'board') {
    const board = data.boards.find((b) => b.id === route.id)
    body = board ? (
      <BoardDetail board={board} data={data} />
    ) : (
      <Status title="Board not found" text="It may have sold out everywhere since the last refresh." />
    )
  } else {
    body = (
      <>
        <Hero data={data} />
        <Marketplace data={data} filters={filters} onFilters={setFilters} />
        <StoresSection data={data} onPickStore={pickStore} />
      </>
    )
  }

  return (
    <>
      <Header query={filters.query} onQuery={setQuery} />
      <main>{body}</main>
      <Footer />
    </>
  )
}

function Status({ title, text }: { title: string; text: string }) {
  return (
    <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: 28 }}>
        {title}
      </h1>
      <p style={{ color: 'var(--muted)' }}>{text}</p>
      <a href="#/" className="btn" style={{ marginTop: 16 }}>
        Back to marketplace
      </a>
    </div>
  )
}
