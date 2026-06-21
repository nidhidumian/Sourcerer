import { User, WandSparkles } from "lucide-react";
import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

function App() {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const profile = analysis?.profile;

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
      </main>
    </div>
  );
}

function formatList(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

export default App;
