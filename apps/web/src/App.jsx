import { User, WandSparkles } from "lucide-react";

function App() {
  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <div className="page-shell">
      <div className="header-border">
        <div className="page-wrap">
          <header className="app-header" aria-label="Sourcerer navigation">
            <button className="header-icon-button" type="button" aria-label="Menu">
              <WandSparkles size={24} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <nav className="center-nav" aria-label="Primary navigation">
              <a href="/" aria-label="Sourcerer home">
                Sourcerer,
              </a>
              <a href="/" aria-label="Events Sourcerer">
                Events Sourcerer
              </a>
            </nav>
            <button
              className="header-icon-button"
              type="button"
              aria-label="Sign up or log in"
            >
              <User size={24} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </header>
        </div>
      </div>

      <main className="page-wrap home-hero" aria-labelledby="hero-title">
        <section className="hero-copy">
          <p className="hero-eyebrow">B2B EVENTS</p>
          <h1 id="hero-title">
            Don&apos;t share your deep, dark secrets, just <em>your domain</em>.
          </h1>
          <p>
            I will study your product, understand your ICP, industry and the
            verticals your product is useful for to give you a list of events
            specifically for your field and event marketing goals.
          </p>
        </section>

        <form className="search-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="domain">
            Company domain
          </label>
          <input
            id="domain"
            name="domain"
            type="text"
            size={6}
            autoComplete="url"
            placeholder="DOMAIN"
          />

          <label className="sr-only" htmlFor="geography">
            Target geography
          </label>
          <input
            id="geography"
            name="geography"
            type="text"
            size={16}
            autoComplete="country-name"
            placeholder="TARGET GEOGRAPHY"
          />

          <button type="submit">SUBMIT</button>
        </form>
      </main>
    </div>
  );
}

export default App;
