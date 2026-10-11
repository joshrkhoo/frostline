import './Header.css'

interface Props {
  query: string
  onQuery: (q: string) => void
}

export function Header({ query, onQuery }: Props) {
  return (
    <header className="header">
      <div className="container header-inner">
        <a href="#/" className="logo" aria-label="Frostline home">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
            <defs>
              <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#bdf1ff" />
                <stop offset="1" stopColor="#3ba4ff" />
              </linearGradient>
            </defs>
            <rect x="12" y="2" width="8" height="28" rx="4" fill="url(#logo-g)" transform="rotate(28 16 16)" />
            <circle cx="16" cy="16" r="1.8" fill="#ffb547" />
          </svg>
          <span className="display">FROSTLINE</span>
        </a>

        <nav className="nav">
          <a href="#/" className="nav-link active">
            Snowboards
          </a>
          <span className="nav-link soon" title="Coming soon">
            Bindings <em>soon</em>
          </span>
          <span className="nav-link soon" title="Coming soon">
            Boots <em>soon</em>
          </span>
          <span className="nav-link soon" title="Coming soon">
            Gear <em>soon</em>
          </span>
        </nav>

        <label className="search glass">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Search snowboards</span>
          <input
            type="search"
            placeholder="Search boards, brands, styles…"
            value={query}
            onChange={(e) => {
              onQuery(e.target.value)
              if (location.hash.startsWith('#/board')) location.hash = '#/'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') document.getElementById('market')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
          {query && (
            <button className="search-clear" onClick={() => onQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
        </label>
      </div>
    </header>
  )
}
