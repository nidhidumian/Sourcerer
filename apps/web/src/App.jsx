function App() {
  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <div className="page-shell">
      <div className="header-border">
        <div className="page-wrap">
          <header className="app-header" aria-label="Sourcerer navigation">
            <div className="header-spacer" aria-hidden="true" />
            <nav className="center-nav" aria-label="Primary navigation">
              <a href="/" aria-label="Sourcerer home">
                Sourcerer,
              </a>
              <a href="/" aria-label="Events Sourcerer">
                Events Sourcerer
              </a>
            </nav>
            <button className="login-button" type="button">
              SIGN UP OR LOG IN
            </button>
          </header>
        </div>
      </div>

      <main className="page-wrap home-hero" aria-labelledby="hero-title">
        <section className="hero-copy">
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
