import { User, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

function App() {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [showWishlistNote, setShowWishlistNote] = useState(false);
  const [showSponsorshipNote, setShowSponsorshipNote] = useState(false);
  const profile = analysis?.profile;
  const eventList = events?.events;

  useEffect(() => {
    const searchId = analysis?.searchId;

    if (!searchId) {
      setEvents(null);
      setEventsError("");
      setIsLoadingEvents(false);
      return;
    }

    let cancelled = false;

    async function loadEvents() {
      setEvents(null);
      setEventsError("");
      setIsLoadingEvents(true);

      try {
        const response = await fetch(
          apiUrl(`/api/events?searchId=${encodeURIComponent(searchId)}`),
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Events request failed.");
        }

        if (!cancelled) {
          setEvents(payload);
        }
      } catch (requestError) {
        if (!cancelled) {
          setEventsError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [analysis?.searchId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const domain = String(formData.get("domain") || "").trim();
    const geography = String(formData.get("geography") || "").trim();

    setAnalysis(null);
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain, geography }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Analyze request failed.");
      }

      setAnalysis(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
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
            required
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
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "STUDYING" : "SUBMIT"}
          </button>
        </form>

        <section className="analysis-feedback" aria-live="polite">
          {error ? <p className="analysis-error">{error}</p> : null}
          {profile ? (
            <div className="analysis-result">
              <p className="analysis-kicker">
                {analysis.cached ? "CACHED ANALYSIS" : "ANALYSIS READY"}
              </p>
              <h2>{profile.companyName || analysis.domain}</h2>
              <p className="analysis-oneliner">{profile.oneLiner}</p>

              <div className="analysis-section">
                <p className="analysis-eyebrow">ICP</p>
                <p className="analysis-value">{formatList(profile.icp)}</p>
              </div>

              <div className="analysis-section">
                <p className="analysis-eyebrow">INDUSTRY</p>
                <p className="analysis-value">{profile.industry}</p>
              </div>

              <div className="analysis-section">
                <p className="analysis-eyebrow">VERTICALS</p>
                <p className="analysis-value">{formatList(profile.verticals)}</p>
              </div>

              <div className="analysis-section">
                <p className="analysis-eyebrow">FOR {analysis.geography}</p>
                <p className="analysis-value">{profile.scoreRationale}</p>
              </div>

              <hr className="analysis-rule" />
            </div>
          ) : null}
        </section>

        {analysis ? (
          <section className="events-feedback" aria-live="polite">
            {isLoadingEvents ? (
              <p className="events-kicker">FINDING EVENTS…</p>
            ) : null}
            {eventsError ? (
              <p className="analysis-error">{eventsError}</p>
            ) : null}
            {eventList && eventList.length > 0 ? (
              <div className="events-result">
                <p className="events-kicker">
                  {events.cached ? "CACHED EVENTS" : "EVENTS READY"}
                </p>
                <ul className="event-card-list">
                  {eventList.map((item) => (
                    <li className="event-card" key={item.url}>
                      {item.organizer ? (
                        <p className="event-organizer">{item.organizer}</p>
                      ) : null}
                      <h3 className="event-name">{item.name}</h3>
                      {item.why || item.description ? (
                        <p className="event-description">
                          {item.why || item.description}
                        </p>
                      ) : null}
                      <dl className="event-meta">
                        <div>
                          <dt>DATE</dt>
                          <dd>{item.date || "TBD"}</dd>
                        </div>
                        <div>
                          <dt>LOCATION</dt>
                          <dd>{item.location || "TBD"}</dd>
                        </div>
                      </dl>
                      {isTbd(item.date) &&
                      item.priorYear &&
                      (item.priorYear.date || item.priorYear.location) ? (
                        <p className="event-prioryear">
                          Last year:{" "}
                          {[item.priorYear.date, item.priorYear.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {item.lastYearSponsors &&
                      item.lastYearSponsors.length > 0 ? (
                        <p className="event-sponsors">
                          Last year sponsors: {item.lastYearSponsors.join(", ")}
                        </p>
                      ) : null}
                      {item.agenda && item.agenda.length > 0 ? (
                        <div className="event-extra">
                          <dt>AGENDA</dt>
                          <dd>{item.agenda.join(" · ")}</dd>
                        </div>
                      ) : null}
                      <div className="event-pills">
                        <a
                          className="event-pill"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          VISIT EVENT
                        </a>
                        <button
                          className="event-pill"
                          type="button"
                          onClick={() => setShowWishlistNote(true)}
                        >
                          WISHLIST
                        </button>
                        <button
                          className="event-pill"
                          type="button"
                          onClick={() => setShowSponsorshipNote(true)}
                        >
                          REQUEST SPONSORSHIP KIT
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {eventList && eventList.length === 0 && !isLoadingEvents && !eventsError ? (
              <p className="events-kicker">NO EVENTS FOUND</p>
            ) : null}
          </section>
        ) : null}
      </main>

      {showWishlistNote ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-title"
          onClick={() => setShowWishlistNote(false)}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <p className="events-kicker" id="wishlist-title">
              WISHLIST
            </p>
            <p className="modal-body">
              Sign up coming soon. We&apos;ll let you save events soon.
            </p>
            <button
              className="event-pill"
              type="button"
              onClick={() => setShowWishlistNote(false)}
            >
              GOT IT
            </button>
          </div>
        </div>
      ) : null}

      {showSponsorshipNote ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sponsorship-title"
          onClick={() => setShowSponsorshipNote(false)}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <p className="events-kicker" id="sponsorship-title">
              REQUEST SPONSORSHIP KIT
            </p>
            <p className="modal-body">
              Feature coming soon. We&apos;ll let you send events to request a
              media kit.
            </p>
            <button
              className="event-pill"
              type="button"
              onClick={() => setShowSponsorshipNote(false)}
            >
              GOT IT
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatList(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function isTbd(value) {
  return !value || /^tbd$/i.test(String(value).trim());
}

export default App;
