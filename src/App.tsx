import { useState } from 'react'
import { BindingsHero } from './components/BindingsHero'
import { BoardDetail } from './components/BoardDetail'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Marketplace } from './components/Marketplace'
import { Footer, StoresSection } from './components/StoresSection'
import { useMarket } from './lib/data'
import { DEFAULT_FILTERS, type Filters } from './lib/filters'
import { listHref, useRoute } from './lib/router'
import type { Kind } from './types'

const NOUN: Record<Kind, string> = { board: 'snowboard', binding: 'binding' }

export default function App() {
  const route = useRoute()
  const kind = route.kind
  const { data, error } = useMarket(kind)
  // Boards and bindings keep their own filters, so switching tabs doesn't lose either.
  const [filtersByKind, setFiltersByKind] = useState<Record<Kind, Filters>>({ board: DEFAULT_FILTERS, binding: DEFAULT_FILTERS })
  const filters = filtersByKind[kind]
  const setFilters = (f: Filters) => setFiltersByKind((all) => ({ ...all, [kind]: f }))

  const setQuery = (query: string) => setFiltersByKind((all) => ({ ...all, [kind]: { ...all[kind], query } }))
  const pickStore = (id: string) => {
    setFilters({ ...DEFAULT_FILTERS, stores: [id] })
    document.getElementById('market')?.scrollIntoView({ behavior: 'smooth' })
  }

  let body: React.ReactNode
  if (error) body = <Status title="Couldn't load the market" text={error} />
  else if (!data) body = <Status title="Loading the market…" text={`Fetching the latest ${NOUN[kind]} prices.`} />
  else if (route.page === 'item') {
    const item = data.boards.find((b) => b.id === route.id)
    body = item ? (
      <BoardDetail board={item} data={data} />
    ) : (
      <Status title={`${kind === 'binding' ? 'Binding' : 'Board'} not found`} text="It may have sold out everywhere since the last refresh." kind={kind} />
    )
  } else if (kind === 'binding') {
    body = (
      <>
        <BindingsHero data={data} />
        <Marketplace kind="binding" data={data} filters={filters} onFilters={setFilters} />
      </>
    )
  } else {
    body = (
      <>
        <Hero data={data} />
        <Marketplace kind="board" data={data} filters={filters} onFilters={setFilters} />
        <StoresSection data={data} onPickStore={pickStore} />
      </>
    )
  }

  return (
    <>
      <Header kind={kind} query={filters.query} onQuery={setQuery} />
      <main>{body}</main>
      <Footer />
    </>
  )
}

function Status({ title, text, kind = 'board' }: { title: string; text: string; kind?: Kind }) {
  return (
    <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: 28 }}>
        {title}
      </h1>
      <p style={{ color: 'var(--muted)' }}>{text}</p>
      <a href={listHref(kind)} className="btn" style={{ marginTop: 16 }}>
        Back to marketplace
      </a>
    </div>
  )
}
