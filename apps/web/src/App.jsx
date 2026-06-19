function App() {
  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <div className="page-shell">
      <header className="site-header" aria-label="Sourcerer navigation">
        <nav className="center-nav" aria-label="Primary navigation">
          <a href="/" aria-label="Sourcerer home">
            Sourcerer
          </a>
          <a href="/" aria-label="Events Sourcerer">
            Events Sourcerer
          </a>
        </nav>
        <button className="login-button" type="button">
          SIGN UP OR LOG IN
        </button>
      </header>

      <main className="hero" aria-labelledby="hero-title">
        <section className="hero-copy">
          <h1 id="hero-title">
            Don&apos;t share your deep, dark secrets, just <em>your domain</em>
          </h1>
          <p>
            I will study your product, understand decision makers, industry and
            what verticals your product is useful for to give you a list of
            events specifically for your field and event marketing goals.
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
            autoComplete="url"
            placeholder="TYPE DOMAIN HERE"
          />

          <label className="sr-only" htmlFor="geography">
            Target geography
          </label>
          <input
            id="geography"
            name="geography"
            type="text"
            autoComplete="country-name"
            placeholder="type target geography here"
          />

          <button type="submit">SUBMIT</button>
        </form>
      </main>
    </div>
  );
}

export default App;
