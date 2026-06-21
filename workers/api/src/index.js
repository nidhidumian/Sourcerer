import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

const CACHE_TTL_HOURS = 24;
const DEFAULT_ANALYZE_MONTHLY_LIMIT = 300;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const DEFAULT_RESEARCH_MAX_OUTPUT_TOKENS = 1600;
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// TICKET-006 — Firecrawl is used to scrape the homepage + customer stories so
// the profile is grounded in real site content instead of a domain guess.
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";
const DEFAULT_FIRECRAWL_HOMEPAGE_CHARS = 9000;
const DEFAULT_FIRECRAWL_STORY_CHARS = 6000;
const MAX_CUSTOMER_STORIES = 2;
// Homepage link paths that usually point at customer stories / case studies.
const STORY_PATH_PATTERNS = [
  /\/customer-stor(?:y|ies)/i,
  /\/customers?\b/i,
  /\/case-stud/i,
  /\/success-stor/i,
  /\/stories\b/i,
  /\/case-study/i,
  /\/resources?\/.*case/i,
];

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const DEFAULT_EXA_SEARCH_MONTHLY_LIMIT = 300;
const DEFAULT_EXA_EVENTS_MAX_QUERIES = 10;
const DEFAULT_EXA_RESULTS_PER_QUERY = 5;
const DEFAULT_EXA_MAX_EVENTS = 12;
const DEFAULT_EVENTS_LOOKAHEAD_MONTHS = 12;
const DEFAULT_EVENTS_CACHE_VERSION = "5";

// Known predatory / spam conference aggregators to drop from results. Operators
// can extend this at runtime via the EVENTS_SPAM_DOMAINS env var.
const SPAM_HOST_SUBSTRINGS = [
  "scitechseries",
  "sciencefather",
  "sciedutech",
  "conferenceseries",
  "alliedacademies",
  "waset.org",
  "iastem",
  "researchfora",
  "iferp",
];

// Canonical country -> known aliases (all lower case). Used for the strict
// geography gate. Kept intentionally small; unknown geographies fall back to a
// word-boundary string match.
const COUNTRY_ALIASES = {
  "united states": [
    "united states",
    "united states of america",
    "usa",
    "u.s.",
    "u.s.a.",
    "us",
  ],
  canada: ["canada"],
  "united kingdom": [
    "united kingdom",
    "uk",
    "u.k.",
    "great britain",
    "britain",
    "england",
    "scotland",
    "wales",
  ],
  ireland: ["ireland"],
  germany: ["germany", "deutschland"],
  france: ["france"],
  spain: ["spain"],
  portugal: ["portugal"],
  italy: ["italy"],
  netherlands: ["netherlands", "holland"],
  poland: ["poland"],
  india: ["india"],
  singapore: ["singapore"],
  australia: ["australia"],
  "united arab emirates": ["united arab emirates", "uae"],
};

// US state names + 2-letter abbreviations, used to infer "United States" from a
// grounded location string (e.g. "Austin, TX" / "Las Vegas, Nevada") when the
// country is not spelled out. "georgia" is intentionally omitted (country clash).
const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "hawaii", "idaho", "illinois",
  "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
  "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
  "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
  "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
  "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee",
  "texas", "utah", "vermont", "virginia", "washington", "west virginia",
  "wisconsin", "wyoming", "district of columbia",
]);
const US_STATE_ABBREVS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

// Small curated flagship map. Each entry is a major recurring B2B event tied to a
// known country. It is shown as a TBD anchor only when its country matches the
// search geography AND its tags intersect the analyze output. Intentionally short.
// Generic tags are too broad to anchor a flagship on their own — almost every
// B2B company matches them. A flagship only triggers when one of its *specific*
// (non-generic) tags matches the company's industry / recommended event types.
const GENERIC_TAGS = new Set([
  "saas",
  "b2b",
  "b2c",
  "cloud",
  "security",
  "ai",
  "marketing",
  "tech",
  "startup",
  "data",
  "it",
  "software",
  "developer",
  "enterprise",
]);

// `lastYearSponsors` lists well-known sponsors/exhibitors of the prior edition.
// These are grounded names shown on the card (up to 5), with any analyze
// competitors that appear here surfaced first.
const FLAGSHIP_EVENTS = [
  {
    name: "AWS re:Invent",
    organizer: "Amazon Web Services",
    url: "https://reinvent.awsevents.com/",
    country: "United States",
    description:
      "AWS's flagship cloud computing conference covering infrastructure, DevOps, data, and security.",
    priorYearDate: "Dec 2-6, 2024",
    priorYearLocation: "Las Vegas, United States",
    tags: ["cloud", "infrastructure", "devops", "developer"],
    lastYearSponsors: [
      "HashiCorp",
      "Datadog",
      "Snowflake",
      "MongoDB",
      "GitLab",
      "CrowdStrike",
      "Okta",
      "Palo Alto Networks",
      "Wiz",
      "1Password",
    ],
  },
  {
    name: "Google Cloud Next",
    organizer: "Google",
    url: "https://cloud.withgoogle.com/next",
    country: "United States",
    description:
      "Google Cloud's annual conference for developers and IT leaders building on Google Cloud.",
    priorYearDate: "Apr 9-11, 2024",
    priorYearLocation: "Las Vegas, United States",
    tags: ["cloud", "infrastructure", "developer"],
    lastYearSponsors: [
      "HashiCorp",
      "Datadog",
      "MongoDB",
      "Snowflake",
      "GitLab",
      "Palo Alto Networks",
      "Okta",
    ],
  },
  {
    name: "Microsoft Ignite",
    organizer: "Microsoft",
    url: "https://ignite.microsoft.com/",
    country: "United States",
    description:
      "Microsoft's flagship conference for IT pros and developers on cloud, security, and productivity.",
    priorYearDate: "Nov 19-22, 2024",
    priorYearLocation: "Chicago, United States",
    tags: ["cloud", "infrastructure", "developer"],
    lastYearSponsors: [
      "CrowdStrike",
      "Okta",
      "HashiCorp",
      "Palo Alto Networks",
      "Rubrik",
    ],
  },
  {
    name: "Dreamforce",
    organizer: "Salesforce",
    url: "https://www.salesforce.com/dreamforce/",
    country: "United States",
    description:
      "Salesforce's flagship event for CRM, sales, service, and go-to-market teams.",
    priorYearDate: "Sep 17-19, 2024",
    priorYearLocation: "San Francisco, United States",
    tags: ["crm", "sales"],
    lastYearSponsors: ["Gong", "Outreach", "ZoomInfo", "Salesloft", "HubSpot"],
  },
  {
    name: "SaaStr Annual",
    organizer: "SaaStr",
    url: "https://www.saastrannual.com/",
    country: "United States",
    description:
      "The largest community event for B2B SaaS founders, revenue, and go-to-market leaders.",
    priorYearDate: "Sep 10-12, 2024",
    priorYearLocation: "San Mateo, United States",
    tags: ["saas"],
    lastYearSponsors: ["Stripe", "HubSpot", "Gong", "Salesloft"],
  },
  {
    name: "Money20/20 USA",
    organizer: "Money20/20",
    url: "https://www.money2020.com/",
    country: "United States",
    description:
      "The world's largest fintech event covering payments, banking, and financial services.",
    priorYearDate: "Oct 27-30, 2024",
    priorYearLocation: "Las Vegas, United States",
    tags: ["fintech", "payments"],
    lastYearSponsors: [
      "Stripe",
      "Plaid",
      "Adyen",
      "Marqeta",
      "Visa",
      "Mastercard",
      "Brex",
      "Ramp",
    ],
  },
  {
    name: "HIMSS Global Health Conference",
    organizer: "HIMSS",
    url: "https://www.himssconference.com/",
    country: "United States",
    description:
      "The leading health information and technology conference for healthcare and medtech.",
    priorYearDate: "Mar 11-15, 2024",
    priorYearLocation: "Orlando, United States",
    tags: ["healthcare", "medtech"],
    lastYearSponsors: ["Epic", "Oracle Health", "Microsoft", "Salesforce"],
  },
  {
    name: "RSA Conference",
    organizer: "RSA",
    url: "https://www.rsaconference.com/",
    country: "United States",
    description:
      "The world's leading cybersecurity and information security conference.",
    priorYearDate: "May 6-9, 2024",
    priorYearLocation: "San Francisco, United States",
    tags: ["cybersecurity", "security", "infosec"],
    lastYearSponsors: [
      "CrowdStrike",
      "Palo Alto Networks",
      "Okta",
      "CyberArk",
      "HashiCorp",
      "1Password",
      "Zscaler",
      "Fortinet",
      "Cisco",
      "Wiz",
    ],
  },
  {
    name: "Legalweek",
    organizer: "ALM",
    url: "https://www.event.law.com/legalweek",
    country: "United States",
    description:
      "The premier event for legal technology, legal operations, and law firm innovation.",
    priorYearDate: "Jan 28-31, 2025",
    priorYearLocation: "New York, United States",
    tags: ["legal", "legaltech"],
    lastYearSponsors: [
      "Relativity",
      "iManage",
      "Litera",
      "Ironclad",
      "LinkSquares",
      "Evisort",
      "Clio",
    ],
  },
  {
    name: "Web Summit",
    organizer: "Web Summit",
    url: "https://websummit.com/",
    country: "Portugal",
    description:
      "One of the largest global technology conferences, spanning startups, software, and investors.",
    priorYearDate: "Nov 11-14, 2024",
    priorYearLocation: "Lisbon, Portugal",
    tags: ["tech", "startup"],
    lastYearSponsors: ["Stripe", "Amazon Web Services", "Google Cloud"],
  },
  {
    name: "Collision",
    organizer: "Web Summit",
    url: "https://collisionconf.com/",
    country: "Canada",
    description:
      "North America's fast-growing tech conference for startups, software, and investors.",
    priorYearDate: "Jun 17-20, 2024",
    priorYearLocation: "Toronto, Canada",
    tags: ["tech", "startup"],
    lastYearSponsors: ["Stripe", "Amazon Web Services", "Google Cloud"],
  },
  {
    name: "London Tech Week",
    organizer: "London Tech Week",
    url: "https://londontechweek.com/",
    country: "United Kingdom",
    description:
      "The UK's flagship technology festival connecting startups, enterprises, and investors.",
    priorYearDate: "Jun 10-14, 2024",
    priorYearLocation: "London, United Kingdom",
    tags: ["tech", "startup"],
    lastYearSponsors: ["Amazon Web Services", "Google Cloud", "Microsoft"],
  },
];

const RELEVANCE_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "your",
  "their",
  "that",
  "this",
  "from",
  "into",
  "event",
  "events",
  "company",
  "companies",
  "team",
  "teams",
  "business",
  "businesses",
  "platform",
  "solution",
  "solutions",
  "software",
  "product",
  "products",
  "service",
  "services",
  "tool",
  "tools",
  "based",
  "other",
  "more",
  "they",
  "who",
  "are",
  "use",
  "using",
]);

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN || origin || "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.post("/api/analyze", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const domain = normalizeDomain(payload?.domain);
  const geography = normalizeGeography(payload?.geography);

  if (!domain || !geography) {
    return c.json(
      {
        error:
          "Please provide a valid company domain and target geography.",
      },
      400,
    );
  }

  if (!c.env.DB) {
    return c.json({ error: "D1 database binding is not configured." }, 503);
  }

  const cached = await getCachedAnalysis(c.env.DB, domain, geography);

  if (cached) {
    return c.json({
      searchId: cached.id,
      domain,
      geography,
      cached: true,
      createdAt: cached.created_at,
      profile: parseJson(cached.profile_json, {}),
      queries: parseJson(cached.queries_json, []),
    });
  }

  if (!c.env.OPENAI_API_KEY) {
    return c.json(
      {
        error:
          "OpenAI is not configured yet. Add OPENAI_API_KEY to the Worker secrets.",
      },
      503,
    );
  }

  let profile = null;
  let queries = [];
  let researchSource = "domain";
  let consumedCall = false;
  // Always fetch the real budget so the response is accurate even on a cache hit.
  const budget = await getAnalyzeBudget(c.env.DB, c.env);

  // 1. Reuse a recent per-domain research profile (geography-independent).
  const cachedResearch = await getCachedResearch(c.env.DB, domain);
  if (cachedResearch) {
    profile = parseJson(cachedResearch.profile_json, null);
    if (profile) {
      queries = toStringArray(profile.searchQueries);
      researchSource = "research-cache";
    }
  }

  // 2. Otherwise run a fresh analysis (Firecrawl research preferred).
  if (!profile) {
    if (budget.remaining <= 0) {
      return c.json(
        {
          error:
            "Analyze budget reached. Try again after cached results are available or raise OPENAI_ANALYZE_MONTHLY_LIMIT.",
        },
        429,
      );
    }

    let result = null;
    if (c.env.FIRECRAWL_API_KEY) {
      try {
        result = await requestCompanyResearch(c.env, domain, geography);
        researchSource = "firecrawl";
        profile = result.profile;
        queries = result.queries;
        await saveCompanyResearch(c.env.DB, domain, profile, result.sources);
      } catch (error) {
        // Fall back to the domain-only analysis below if scraping/research fails.
        console.error(`Firecrawl research failed for ${domain}:`, error?.message || error);
        result = null;
      }
    }

    if (!profile) {
      try {
        const legacy = await requestOpenAiAnalysis(c.env, domain, geography);
        profile = toProfile(legacy.analysis);
        queries = toStringArray(legacy.analysis.search_queries);
        result = legacy;
        researchSource = c.env.FIRECRAWL_API_KEY ? "domain-fallback" : "domain";
      } catch (error) {
        return c.json(
          { error: error.message || "OpenAI analysis failed." },
          error.status || 502,
        );
      }
    }

    consumedCall = true;
    await recordAnalytics(c.env.DB, "analyze_openai_call", {
      domain,
      geography,
      model: result?.model || null,
      researchSource,
      sourceCount: toStringArray(profile.researchSources).length,
      usage: result?.usage || null,
    });
  }

  const searchId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO searches (id, domain, geography, profile_json, queries_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(searchId, domain, geography, JSON.stringify(profile), JSON.stringify(queries))
    .run();

  return c.json({
    searchId,
    domain,
    geography,
    cached: false,
    researchSource,
    profile,
    queries,
    budget: {
      monthlyLimit: budget.limit,
      callsRemainingAfterThis: Math.max(0, budget.remaining - (consumedCall ? 1 : 0)),
    },
  });
});

app.get("/api/events", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 database binding is not configured." }, 503);
  }

  const searchId = (c.req.query("searchId") || "").trim();
  const domain = normalizeDomain(c.req.query("domain"));
  const geography = normalizeGeography(c.req.query("geography"));

  const search = await getSearchForEvents(c.env.DB, { searchId, domain, geography });

  if (!search) {
    if (!searchId && (!domain || !geography)) {
      return c.json(
        {
          error:
            "Provide a searchId, or a valid domain and target geography.",
        },
        400,
      );
    }
    return c.json({ error: "No analysis found for the requested search." }, 404);
  }

  const cacheVersion = c.env.EVENTS_CACHE_VERSION || DEFAULT_EVENTS_CACHE_VERSION;
  const profile = parseJson(search.profile_json, {}) || {};
  const cached = await getCachedEvents(c.env.DB, search.id);
  const cachedEvents = cached ? unpackEvents(cached.events_json, cacheVersion) : null;

  if (cachedEvents) {
    return c.json({
      searchId: search.id,
      domain: search.domain,
      geography: search.geography,
      cached: true,
      createdAt: cached.created_at,
      events: cachedEvents,
    });
  }

  if (!c.env.EXA_API_KEY) {
    return c.json(
      {
        error:
          "Exa is not configured yet. Add EXA_API_KEY to the Worker secrets.",
      },
      503,
    );
  }

  const budget = await getExaBudget(c.env.DB, c.env);

  if (budget.remaining <= 0) {
    return c.json(
      {
        error:
          "Events search budget reached. Try again after cached results are available or raise EXA_SEARCH_MONTHLY_LIMIT.",
      },
      429,
    );
  }

  const maxQueries = Math.min(
    toPositiveInteger(c.env.EXA_EVENTS_MAX_QUERIES, DEFAULT_EXA_EVENTS_MAX_QUERIES),
    budget.remaining,
  );
  // Multi-angle planner from the enriched profile; fall back to stored queries.
  let queries = buildEventQueryPlan(profile, search.geography, maxQueries);
  if (queries.length === 0) {
    queries = buildEventQueries(
      parseJson(search.queries_json, []),
      search.geography,
      maxQueries,
    );
  }

  if (queries.length === 0) {
    return c.json({ error: "No search queries are available for this analysis." }, 422);
  }

  let rawEvents;

  try {
    rawEvents = await searchExaEvents(c.env, queries);
  } catch (error) {
    return c.json(
      { error: error.message || "Exa events search failed." },
      error.status || 502,
    );
  }

  const events = curateEvents(rawEvents, {
    geography: search.geography,
    profile,
    lookaheadMonths: toPositiveInteger(
      c.env.EVENTS_LOOKAHEAD_MONTHS,
      DEFAULT_EVENTS_LOOKAHEAD_MONTHS,
    ),
    maxEvents: toPositiveInteger(c.env.EXA_MAX_EVENTS, DEFAULT_EXA_MAX_EVENTS),
    spamHosts: parseSpamHosts(c.env.EVENTS_SPAM_DOMAINS),
  });

  await c.env.DB.prepare(
    `INSERT INTO events_cache (id, search_id, domain, geography, events_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      search.id,
      search.domain,
      search.geography,
      packEvents(cacheVersion, events),
    )
    .run();

  await Promise.all(
    queries.map(() =>
      recordAnalytics(c.env.DB, "events_exa_call", {
        domain: search.domain,
        geography: search.geography,
        searchId: search.id,
        queryCount: queries.length,
        eventCount: events.length,
      }),
    ),
  );

  return c.json({
    searchId: search.id,
    domain: search.domain,
    geography: search.geography,
    cached: false,
    events,
    budget: {
      monthlyLimit: budget.limit,
      callsRemainingAfterThis: Math.max(0, budget.remaining - queries.length),
    },
  });
});

function normalizeDomain(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");

  if (
    normalized.length < 4 ||
    normalized.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

function normalizeGeography(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length < 2 || normalized.length > 80) {
    return null;
  }

  return normalized;
}

async function getCachedAnalysis(db, domain, geography) {
  return db
    .prepare(
      `SELECT id, profile_json, queries_json, created_at
       FROM searches
       WHERE domain = ?
         AND lower(geography) = lower(?)
         AND profile_json IS NOT NULL
         AND queries_json IS NOT NULL
         AND created_at >= datetime('now', ?)
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(domain, geography, `-${CACHE_TTL_HOURS} hours`)
    .first();
}

// The research cache is an optimization, not a hard dependency. If its table is
// missing (migration not yet applied) or D1 errors, degrade to a fresh analysis
// rather than 500-ing the core /api/analyze endpoint.
async function getCachedResearch(db, domain) {
  try {
    return await db
      .prepare(
        `SELECT profile_json, source_urls_json, created_at
         FROM company_research
         WHERE domain = ?
           AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(domain, `-${CACHE_TTL_HOURS} hours`)
      .first();
  } catch {
    return null;
  }
}

async function saveCompanyResearch(db, domain, profile, sources) {
  try {
    await db
      .prepare(
        `INSERT INTO company_research (id, domain, profile_json, source_urls_json)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        domain,
        JSON.stringify(profile),
        JSON.stringify(toStringArray(sources)),
      )
      .run();
  } catch {
    // Non-fatal — the analysis is still returned to the caller.
  }
}

async function getAnalyzeBudget(db, env) {
  return getCallBudget(db, "analyze_openai_call", env.OPENAI_ANALYZE_MONTHLY_LIMIT, DEFAULT_ANALYZE_MONTHLY_LIMIT);
}

async function getExaBudget(db, env) {
  return getCallBudget(db, "events_exa_call", env.EXA_SEARCH_MONTHLY_LIMIT, DEFAULT_EXA_SEARCH_MONTHLY_LIMIT);
}

async function getCallBudget(db, eventName, configuredLimit, defaultLimit) {
  const limit = toPositiveInteger(configuredLimit, defaultLimit);
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM analytics_events
       WHERE event_name = ?
         AND created_at >= datetime('now', '-30 days')`,
    )
    .bind(eventName)
    .first();
  const used = Number(row?.count || 0);

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

async function getSearchForEvents(db, { searchId, domain, geography }) {
  if (searchId) {
    return db
      .prepare(
        `SELECT id, domain, geography, queries_json, profile_json
         FROM searches
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(searchId)
      .first();
  }

  if (!domain || !geography) {
    return null;
  }

  return db
    .prepare(
      `SELECT id, domain, geography, queries_json, profile_json
       FROM searches
       WHERE domain = ?
         AND lower(geography) = lower(?)
         AND queries_json IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(domain, geography)
    .first();
}

async function getCachedEvents(db, searchId) {
  return db
    .prepare(
      `SELECT events_json, created_at
       FROM events_cache
       WHERE search_id = ?
         AND created_at >= datetime('now', ?)
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(searchId, `-${CACHE_TTL_HOURS} hours`)
    .first();
}

function buildEventQueries(queries, geography, maxQueries) {
  if (!Array.isArray(queries)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const raw of queries) {
    if (typeof raw !== "string") {
      continue;
    }
    const base = raw.trim();
    if (!base) {
      continue;
    }
    const query = new RegExp(`\\b${escapeRegExp(geography)}\\b`, "i").test(base)
      ? base
      : `${base} ${geography}`;
    const key = query.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(query);
    if (result.length >= maxQueries) {
      break;
    }
  }

  return result;
}

// TICKET-006 Part B — generate 8-12 intentional Exa queries the way an event
// marketer would search: broad category + geography, vertical/use-case angles,
// adjacent markets, and named industry anchors. Never just the domain or oneLiner.
function buildEventQueryPlan(profile, geography, maxQueries) {
  if (!profile || typeof profile !== "object") {
    return [];
  }

  const g = (geography || "").trim();
  // Strip trailing event-type words ("... conferences" / "... summit") so we
  // don't produce "customer experience conferences conferences USA".
  const themes = dedupeStrings(
    [
      ...toStringArray(profile.eventSearchThemes),
      ...toStringArray(profile.recommendedEventTypes),
    ].map(stripEventTypeWords),
  );
  const verticalsAndUseCases = dedupeStrings([
    ...toStringArray(profile.verticals),
    ...toStringArray(profile.useCases),
  ]);
  const adjacents = adjacentMarketTopics(profile.adjacentMarkets);

  const broad = [];
  for (const theme of themes.slice(0, 3)) {
    broad.push(`${theme} conferences ${g}`);
    broad.push(`${theme} trade shows ${g}`);
  }

  const angle = themes[0] || stripEventTypeWords(profile.industry) || "industry";
  const verticalQueries = verticalsAndUseCases
    .slice(0, 4)
    .map((vertical) => `${vertical} ${angle} events ${g}`);

  const adjacentQueries = adjacents
    .slice(0, 2)
    .map((topic) => `${topic} innovation summit ${g}`);

  const anchorQueries = matchedFlagships(profile, geography)
    .slice(0, 3)
    .map((flagship) => `${flagship.name} ${g}`);

  // Interleave by priority then cap: guarantees broad coverage plus angles.
  const ordered = [
    ...broad.slice(0, 4),
    ...verticalQueries.slice(0, 3),
    ...adjacentQueries,
    ...anchorQueries,
    ...broad.slice(4),
  ];

  const seen = new Set();
  const result = [];
  for (const raw of ordered) {
    const query = raw.replace(/\s+/g, " ").trim();
    const key = query.toLowerCase();
    if (!query || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(query);
    if (result.length >= maxQueries) {
      break;
    }
  }

  return result;
}

function adjacentMarketTopics(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const topics = value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      return entry && typeof entry.market === "string" ? entry.market : "";
    })
    .filter(Boolean);
  return dedupeStrings(topics);
}

function stripEventTypeWords(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(
      /\b(conferences?|trade ?shows?|summits?|expos?|events?|forums?|shows?|congress(?:es)?|conventions?|symposi(?:um|a)|weeks?|fairs?|meetups?)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

async function searchExaEvents(env, queries) {
  const numResults = toPositiveInteger(
    env.EXA_RESULTS_PER_QUERY,
    DEFAULT_EXA_RESULTS_PER_QUERY,
  );

  const responses = await Promise.all(
    queries.map((query) => requestExaSearch(env.EXA_API_KEY, query, numResults)),
  );

  const byUrl = new Map();

  for (const response of responses) {
    for (const result of response.results || []) {
      const event = toRawEvent(result);
      if (!event) {
        continue;
      }
      if (!byUrl.has(event.url)) {
        byUrl.set(event.url, event);
      }
    }
  }

  return Array.from(byUrl.values());
}

async function requestExaSearch(apiKey, query, numResults) {
  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults,
      contents: {
        summary: {
          query:
            "Extract details about the B2B event described on this page. Set isEvent to false if the page is not about a specific real-world or virtual event. Only fill a field if the page actually states it; leave it blank otherwise — never guess the country.",
          schema: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              eventName: { type: "string", description: "The event name" },
              description: {
                type: "string",
                description: "One concise sentence describing the event",
              },
              organizer: { type: "string", description: "Organizing company or body" },
              city: { type: "string", description: "Host city" },
              country: {
                type: "string",
                description:
                  "Host country only if explicitly stated on the page; otherwise blank",
              },
              startDate: {
                type: "string",
                description:
                  "Next/upcoming start date as YYYY-MM-DD when determinable, else blank",
              },
              dateText: {
                type: "string",
                description: "Human-readable date or date range to display",
              },
              isEvent: {
                type: "boolean",
                description: "Whether the page describes a specific event",
              },
              isRecurring: {
                type: "boolean",
                description: "Whether this is a recurring annual/series event",
              },
              priorYearDate: {
                type: "string",
                description: "Date of the most recent prior edition, if mentioned",
              },
              priorYearLocation: {
                type: "string",
                description: "Location of the most recent prior edition, if mentioned",
              },
              agenda: {
                type: "array",
                items: { type: "string" },
                description:
                  "Substantive agenda topics, session tracks, or themes only — exclude website navigation/section labels (Register, Sponsors, About, Venue, Past speakers, etc.)",
              },
              sponsors: {
                type: "array",
                items: { type: "string" },
                description:
                  "Sponsor or exhibitor company names from the most recent edition, if listed anywhere on the page (sponsors/exhibitors/partners sections)",
              },
              sponsorshipEmail: {
                type: "string",
                description: "Sponsorship/exhibitor contact email, if listed",
              },
              contactEmail: {
                type: "string",
                description: "General contact email, if listed",
              },
            },
            required: ["eventName", "isEvent"],
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error || data?.message || "Exa events search failed.";
    const error = new Error(
      typeof message === "string" ? message : "Exa events search failed.",
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function toRawEvent(result) {
  const url = typeof result?.url === "string" ? result.url.trim() : "";
  if (!url) {
    return null;
  }

  const summary = parseJson(result.summary, null);

  if (summary && summary.isEvent === false) {
    return null;
  }

  const name = cleanText(summary?.eventName) || cleanText(result.title);
  if (!name) {
    return null;
  }

  return {
    name,
    organizer: cleanText(summary?.organizer),
    description: cleanText(summary?.description),
    city: cleanText(summary?.city),
    country: cleanText(summary?.country),
    startDate: cleanText(summary?.startDate),
    dateText: cleanText(summary?.dateText),
    isRecurring: summary?.isRecurring === true,
    priorYearDate: cleanText(summary?.priorYearDate),
    priorYearLocation: cleanText(summary?.priorYearLocation),
    agenda: cleanTextArray(summary?.agenda),
    sponsors: cleanTextArray(summary?.sponsors),
    sponsorshipEmail:
      cleanEmail(summary?.sponsorshipEmail) || cleanEmail(summary?.contactEmail),
    url,
    source: "exa",
  };
}

// Apply the full quality pipeline: strict geography gate, date window, relevance
// (fail open), flagship anchors, grounded competitor line, sort, and cap.
function curateEvents(rawEvents, { geography, profile, lookaheadMonths, maxEvents, spamHosts }) {
  const byKey = new Map();
  const addEvent = (event) => {
    // Dedupe by normalized event name + URL so the same series from two
    // different query angles collapses into one card.
    const key = `${normalizeEventName(event.name)}|${(event.url || "").toLowerCase()}`;
    if (!byKey.has(key)) {
      byKey.set(key, event);
    }
  };

  for (const event of rawEvents) {
    addEvent(event);
  }
  for (const flagship of curatedFlagships(profile, geography)) {
    addEvent(flagship);
  }

  let events = Array.from(byKey.values());

  // Block obvious predatory / spam conference aggregators.
  events = events.filter((event) => !isSpamEvent(event, spamHosts));

  // Strict geography hard gate — applies to ALL events (flagship included).
  events = events.filter((event) => geographyMatchState(event, geography) === "match");

  // Date window — TBD / flagship events are exempt and pinned to the bottom.
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const windowEnd = new Date(now);
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + lookaheadMonths);

  for (const event of events) {
    event._startDate = isFlagship(event) ? null : parseEventDate(event.startDate || event.dateText);
  }

  events = events.filter((event) => {
    if (isFlagship(event) || !event._startDate) {
      return true;
    }
    return event._startDate >= tomorrow && event._startDate <= windowEnd;
  });

  // Relevance filter keyed off the company's OWN focus (industry + product +
  // recommended event types + search themes + use cases) — NOT the customer
  // verticals it sells into. Fail OPEN: if it would empty the list, keep the
  // best geography-matched results so we never return zero when Exa found real
  // events in geography.
  const relevanceTerms = buildRelevanceTerms(profile);
  if (relevanceTerms.length > 0) {
    const matched = events.filter((event) =>
      eventMatchesRelevance(event, relevanceTerms),
    );
    if (matched.length > 0) {
      events = matched;
    }
  }

  // Grounded "Last year sponsors" line — show extracted/known prior-edition
  // sponsors on every event when data exists, with analyze competitors surfaced
  // first. Additive only; never affects whether an event appears.
  const competitors = toStringArray(profile.competitors);
  for (const event of events) {
    event._lastYearSponsors = buildLastYearSponsors(event.sponsors, competitors);
  }

  // Sort chronologically; TBD / flagship pinned to the bottom.
  events.sort((a, b) => {
    const at = a._startDate ? a._startDate.getTime() : Number.POSITIVE_INFINITY;
    const bt = b._startDate ? b._startDate.getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  return events.slice(0, maxEvents).map(finalizeCard);
}

// Match flagships against the company's OWN category (industry/product/themes),
// NOT the customer verticals/ICP it sells into — otherwise a dev-security company
// whose verticals list "Fintech"/"Healthcare" would wrongly anchor Money20/20 &
// HIMSS. A generic tag (saas/cloud/security/ai/...) can never anchor on its own.
function matchedFlagships(profile, geography) {
  const focusTerms = buildFlagshipTerms(profile);
  const recommendedText = [
    ...toStringArray(profile.recommendedEventTypes),
    ...toStringArray(profile.eventSearchThemes),
  ]
    .join(" ")
    .toLowerCase();

  return FLAGSHIP_EVENTS.filter((flagship) => {
    if (canonicalCountry(flagship.country) !== canonicalCountry(geography)) {
      return false;
    }
    const tagHit = flagship.tags.some(
      (tag) => !GENERIC_TAGS.has(tag) && focusTerms.has(tag),
    );
    const nameHit = recommendedText.includes(flagship.name.toLowerCase());
    return tagHit || nameHit;
  });
}

function curatedFlagships(profile, geography) {
  return matchedFlagships(profile, geography).map((flagship) => ({
    name: flagship.name,
    organizer: flagship.organizer,
    description: flagship.description || "",
    city: "",
    country: flagship.country,
    startDate: "",
    dateText: "",
    isRecurring: true,
    priorYearDate: flagship.priorYearDate,
    priorYearLocation: flagship.priorYearLocation,
    agenda: [],
    sponsors: flagship.lastYearSponsors || [],
    sponsorshipEmail: "",
    url: flagship.url,
    source: "curated",
  }));
}

function isFlagship(event) {
  return event.source === "curated" || (event.isRecurring && !cleanText(event.startDate) && !cleanText(event.dateText));
}

function finalizeCard(event) {
  const flagship = isFlagship(event);
  const tbd = flagship || !event._startDate;

  const locationParts = [event.city, event.country].filter(Boolean);
  const locationKnown = locationParts.join(", ");

  const priorYear =
    event.priorYearDate || event.priorYearLocation
      ? {
          date: event.priorYearDate || null,
          location: event.priorYearLocation || null,
        }
      : null;

  const date = tbd ? "TBD" : event.dateText || formatEventDate(event._startDate);
  const location = flagship ? "TBD" : locationKnown || "TBD";

  return {
    name: event.name,
    organizer: event.organizer || null,
    description: event.description || null,
    date,
    location,
    tbd,
    flagship,
    priorYear,
    agenda: cleanAgenda(event.agenda, { date, location, name: event.name }),
    lastYearSponsors: event._lastYearSponsors || [],
    sponsorshipEmail: event.sponsorshipEmail || null,
    url: event.url,
  };
}

function buildRelevanceTerms(profile) {
  // The company's OWN focus — industry, product, recommended event types, search
  // themes, and use cases. Deliberately excludes customer verticals/ICP, which
  // previously pulled fintech/healthcare events for a dev-security company.
  const sources = [
    profile.industry,
    profile.productCategory,
    ...toStringArray(profile.recommendedEventTypes),
    ...toStringArray(profile.eventSearchThemes),
    ...toStringArray(profile.useCases),
  ];

  const terms = new Set();
  for (const source of sources) {
    if (typeof source !== "string") {
      continue;
    }
    for (const token of source.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 3 && !RELEVANCE_STOPWORDS.has(token)) {
        terms.add(token);
      }
    }
  }

  return Array.from(terms);
}

// Words describing the company's OWN focus (industry, product, and the event
// types it should attend) — NOT the customer verticals/ICP it sells to. Used to
// gate flagship anchors so they stay on-domain.
function buildFlagshipTerms(profile) {
  const sources = [
    profile.industry,
    profile.productCategory,
    ...toStringArray(profile.recommendedEventTypes),
    ...toStringArray(profile.eventSearchThemes),
  ];
  const words = new Set();
  for (const source of sources) {
    if (typeof source !== "string") {
      continue;
    }
    for (const token of source.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length >= 3 && !RELEVANCE_STOPWORDS.has(token)) {
        words.add(token);
      }
    }
  }
  return words;
}

function eventMatchesRelevance(event, terms) {
  const haystack = [
    event.name,
    event.description,
    event.organizer,
    ...(event.agenda || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.some((term) => haystack.includes(term));
}

// Grounded prior-edition sponsors for a card. Competitor matches (from the
// analyze profile) are surfaced first; remaining grounded sponsor names follow.
// Capped at 5. Never invents names — returns [] when no grounded data exists.
function buildLastYearSponsors(sponsors, competitors) {
  const grounded = cleanTextArray(sponsors);
  if (!grounded.length) {
    return [];
  }
  const needles = toStringArray(competitors)
    .map(normalizeCompany)
    .filter(Boolean);
  const isCompetitor = (name) => {
    const hay = normalizeCompany(name);
    if (!hay) {
      return false;
    }
    return needles.some(
      (needle) => hay === needle || hay.includes(needle) || needle.includes(hay),
    );
  };
  const matched = grounded.filter(isCompetitor);
  const rest = grounded.filter((name) => !isCompetitor(name));
  return [...matched, ...rest].slice(0, 5);
}

// Website nav / CTA / section labels that masquerade as agenda topics.
const AGENDA_JUNK_PATTERNS = [
  /^why\b/,
  /^the venue$/,
  /^venues?$/,
  /^past speakers?$/,
  /^speakers?$/,
  /^dispatch$/,
  /^register(ation)?$/,
  /^sponsors?$/,
  /^sponsorships?$/,
  /^exhibit(ors|ing|ion)?$/,
  /^about( us)?$/,
  /^home$/,
  /^contact( us)?$/,
  /^tickets?$/,
  /^get tickets$/,
  /^buy tickets$/,
  /^pricing$/,
  /^faqs?$/,
  /^agenda$/,
  /^schedule$/,
  /^programme?$/,
  /^overview$/,
  /^partners?$/,
  /^media$/,
  /^press$/,
  /^blog$/,
  /^news$/,
  /^gallery$/,
  /^travel$/,
  /^hotels?$/,
  /^accommodations?$/,
  /^login$/,
  /^sign ?in$/,
  /^sign ?up$/,
  /^menu$/,
  /^search$/,
  /^privacy/,
  /^terms/,
  /^cookies?/,
  /^newsletter$/,
  /^subscribe$/,
  /^downloads?$/,
  /^apply$/,
  /^nominate$/,
  /^learn more$/,
  /^read more$/,
  /^view all$/,
  /^see all$/,
  /^more info(rmation)?$/,
  /^day \d+$/,
];

function normalizeAgendaItem(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAgendaJunk(item) {
  const text = normalizeAgendaItem(item);
  if (text.length < 3) {
    return true;
  }
  return AGENDA_JUNK_PATTERNS.some((pattern) => pattern.test(text));
}

// Filter raw agenda items to substantive tracks/topics: drop website nav/CTA
// junk and items that merely repeat the card's date/location/name, then cap at 5.
function cleanAgenda(rawAgenda, { date, location, name }) {
  const items = cleanTextArray(rawAgenda);
  if (!items.length) {
    return [];
  }
  const dupes = new Set(
    [date, location, name]
      .filter((value) => value && value !== "TBD")
      .map(normalizeAgendaItem)
      .filter(Boolean),
  );
  const result = [];
  for (const item of items) {
    if (isAgendaJunk(item)) {
      continue;
    }
    if (dupes.has(normalizeAgendaItem(item))) {
      continue;
    }
    result.push(item);
    if (result.length >= 5) {
      break;
    }
  }
  return result;
}

function normalizeCompany(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|plc|sa|ag)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Normalized event name used for dedupe across query angles. Strips a trailing
// year so "RSA Conference 2025" and "RSA Conference" collapse together.
function normalizeEventName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSpamHosts(value) {
  if (typeof value !== "string" || !value.trim()) {
    return SPAM_HOST_SUBSTRINGS;
  }
  const extra = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...SPAM_HOST_SUBSTRINGS, ...extra];
}

function isSpamEvent(event, spamHosts) {
  const hosts = Array.isArray(spamHosts) ? spamHosts : SPAM_HOST_SUBSTRINGS;
  let host = "";
  try {
    host = new URL(event.url).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (host && hosts.some((needle) => host.includes(needle))) {
    return true;
  }
  // Generic, industry-less "summit" aggregators with no real organizer.
  const name = String(event.name || "").toLowerCase();
  return /\b(international|world)\s+(conference|congress)\s+on\b/.test(name);
}

// Returns "match" | "nonmatch" | "unknown" for the strict geography gate.
function geographyMatchState(event, geography) {
  const target = canonicalCountry(geography);
  // Prior-year location is grounded too — flagships/recurring events often only
  // state where the last edition was held.
  const candidates = [
    event.country,
    event.city,
    event.location,
    event.priorYearLocation,
  ].filter(Boolean);

  // Confirmed match.
  for (const candidate of candidates) {
    const canonical = canonicalCountry(candidate);
    if (target && canonical && canonical === target) {
      return "match";
    }
    if (!target && new RegExp(`\\b${escapeRegExp(geography)}\\b`, "i").test(candidate)) {
      return "match";
    }
  }

  // Infer the United States from a grounded state abbreviation / name when the
  // country is not spelled out (e.g. "Austin, TX" / "Las Vegas, Nevada").
  if (target === "united states" && candidates.some(looksUnitedStates)) {
    return "match";
  }

  // Confirmed non-match (resolves to a different known country).
  for (const candidate of candidates) {
    const canonical = canonicalCountry(candidate);
    if (target && canonical && canonical !== target) {
      return "nonmatch";
    }
  }

  return "unknown";
}

function looksUnitedStates(value) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  for (const name of US_STATE_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      return true;
    }
  }
  // Two-letter abbreviation in a "City, ST" tail (case-sensitive to avoid
  // matching ordinary lowercase words like "in"/"or").
  const abbrev = text.match(/,\s*([A-Z]{2})\b/);
  return Boolean(abbrev && US_STATE_ABBREVS.has(abbrev[1]));
}

function canonicalCountry(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  if (!normalized) {
    return null;
  }

  for (const [canonical, aliases] of Object.entries(COUNTRY_ALIASES)) {
    for (const alias of aliases) {
      if (new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(normalized)) {
        return canonical;
      }
    }
  }

  return null;
}

function parseEventDate(value) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const monthYear = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i,
  );
  if (monthYear) {
    const candidate = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  return null;
}

function formatEventDate(date) {
  if (!date) {
    return "TBD";
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function packEvents(version, events) {
  return JSON.stringify({ version: String(version), events });
}

function unpackEvents(json, version) {
  const parsed = parseJson(json, null);
  if (
    parsed &&
    Array.isArray(parsed.events) &&
    String(parsed.version) === String(version)
  ) {
    return parsed.events;
  }
  return null;
}

function toStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
}

function cleanText(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed || /^(unknown|n\/?a|none|null|tbd|tba)$/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function cleanTextArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const item of value) {
    const text = cleanText(item);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

function cleanEmail(value) {
  const text = cleanText(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// TICKET-006 Part A — scrape homepage + customer stories with Firecrawl, then
// have OpenAI extract an enriched profile grounded in that real content.
async function requestCompanyResearch(env, domain, geography) {
  const homepageUrl = `https://${domain}/`;
  const homepage = await firecrawlScrape(
    env,
    homepageUrl,
    toPositiveInteger(env.FIRECRAWL_HOMEPAGE_CHARS, DEFAULT_FIRECRAWL_HOMEPAGE_CHARS),
  );

  if (!homepage.markdown) {
    const error = new Error("Firecrawl returned no homepage content.");
    error.status = 502;
    throw error;
  }

  const storyUrls = discoverStoryUrls(homepage.links, domain, MAX_CUSTOMER_STORIES);
  const stories = [];
  for (const url of storyUrls) {
    try {
      const story = await firecrawlScrape(
        env,
        url,
        toPositiveInteger(env.FIRECRAWL_STORY_CHARS, DEFAULT_FIRECRAWL_STORY_CHARS),
      );
      if (story.markdown) {
        stories.push({ url, markdown: story.markdown });
      }
    } catch {
      // A failed story scrape is non-fatal — proceed with what we have.
    }
  }

  const sources = [homepageUrl, ...stories.map((story) => story.url)];
  const extraction = await requestResearchExtraction(env, {
    domain,
    geography,
    homepage: homepage.markdown,
    stories,
  });

  return {
    profile: toEnrichedProfile(extraction.analysis, sources),
    queries: toStringArray(extraction.analysis.search_queries),
    model: extraction.model,
    usage: extraction.usage,
    sources,
  };
}

async function firecrawlScrape(env, url, maxChars) {
  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: true,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    const message =
      (data && (data.error || data.message)) ||
      `Firecrawl scrape failed (${response.status}).`;
    const error = new Error(
      typeof message === "string" ? message : "Firecrawl scrape failed.",
    );
    error.status = response.status;
    throw error;
  }

  const payload = data?.data || {};
  const markdown =
    typeof payload.markdown === "string" ? payload.markdown.slice(0, maxChars) : "";
  const links = Array.isArray(payload.links) ? payload.links : [];

  return { markdown, links };
}

function discoverStoryUrls(links, domain, max) {
  const seen = new Set();
  const out = [];
  for (const link of links) {
    if (typeof link !== "string") {
      continue;
    }
    let parsed;
    try {
      parsed = new URL(link);
    } catch {
      continue;
    }
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== domain && !host.endsWith(`.${domain}`)) {
      continue;
    }
    const path = parsed.pathname.toLowerCase();
    if (!STORY_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      continue;
    }
    const key = `${parsed.origin}${parsed.pathname}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(`${parsed.origin}${parsed.pathname}`);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

async function requestResearchExtraction(env, { domain, geography, homepage, stories }) {
  const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const maxOutputTokens = toPositiveInteger(
    env.OPENAI_RESEARCH_MAX_OUTPUT_TOKENS,
    DEFAULT_RESEARCH_MAX_OUTPUT_TOKENS,
  );

  const storyText = stories
    .map((story, index) => `--- CUSTOMER STORY ${index + 1} (${story.url}) ---\n${story.markdown}`)
    .join("\n\n");

  const content = [
    `Company domain: ${domain}`,
    `Target geography: ${geography}`,
    "",
    "--- HOMEPAGE CONTENT (markdown) ---",
    homepage,
    storyText ? `\n${storyText}` : "",
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                "You are a B2B go-to-market research analyst building an event-marketing profile. Use ONLY the provided website content (homepage + customer stories) plus the domain to extract the company's offering, who buys it today, the use cases and verticals seen in their marketing/stories, plausible adjacent markets (with a short rationale each), competitors, and the kinds of events worth attending. Produce 5-10 concrete event search themes an event marketer would type into Google (e.g. 'customer experience conferences', 'contact center trade shows'). Ground every field in the content; infer cautiously and never invent customer names. Return only the requested JSON.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: content }],
        },
      ],
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: "low" },
      store: false,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "b2b_company_research",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              company_name: { type: "string" },
              one_liner: { type: "string" },
              industry: { type: "string" },
              product_category: { type: "string" },
              core_icp: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
              verticals: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
              use_cases: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
              adjacent_markets: {
                type: "array",
                minItems: 0,
                maxItems: 4,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    market: { type: "string" },
                    rationale: { type: "string" },
                  },
                  required: ["market", "rationale"],
                },
              },
              competitors: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
              recommended_event_types: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              event_search_themes: {
                type: "array",
                items: { type: "string" },
                minItems: 5,
                maxItems: 10,
              },
              event_fit_score: { type: "integer", minimum: 0, maximum: 100 },
              score_rationale: { type: "string" },
              search_queries: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 10 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: [
              "company_name",
              "one_liner",
              "industry",
              "product_category",
              "core_icp",
              "verticals",
              "use_cases",
              "adjacent_markets",
              "competitors",
              "recommended_event_types",
              "event_search_themes",
              "event_fit_score",
              "score_rationale",
              "search_queries",
              "confidence",
            ],
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return raiseOpenAiError(response.status, data);
  }

  const outputText = extractOutputText(data);
  const analysis = parseJson(outputText, null);

  if (!analysis) {
    throw new Error("OpenAI returned an empty or invalid research payload.");
  }

  return { analysis, model, usage: data.usage || null };
}

function toEnrichedProfile(analysis, sources) {
  const adjacentMarkets = Array.isArray(analysis.adjacent_markets)
    ? analysis.adjacent_markets
        .filter((entry) => entry && typeof entry.market === "string")
        .map((entry) => ({
          market: entry.market,
          rationale: typeof entry.rationale === "string" ? entry.rationale : "",
        }))
    : [];

  return {
    companyName: analysis.company_name,
    oneLiner: analysis.one_liner,
    industry: analysis.industry,
    productCategory: analysis.product_category,
    icp: toStringArray(analysis.core_icp),
    coreICP: toStringArray(analysis.core_icp),
    verticals: toStringArray(analysis.verticals),
    useCases: toStringArray(analysis.use_cases),
    adjacentMarkets,
    competitors: toStringArray(analysis.competitors),
    eventFitScore: analysis.event_fit_score,
    scoreRationale: analysis.score_rationale,
    recommendedEventTypes: toStringArray(analysis.recommended_event_types),
    eventSearchThemes: toStringArray(analysis.event_search_themes),
    searchQueries: toStringArray(analysis.search_queries),
    confidence: analysis.confidence,
    researchSources: toStringArray(sources),
  };
}

async function requestOpenAiAnalysis(env, domain, geography) {
  const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const maxOutputTokens = toPositiveInteger(
    env.OPENAI_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
  );

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                "Analyze B2B event marketing fit from the supplied company domain and target geography. Infer cautiously when the domain is ambiguous. Return only the structured JSON requested by the response format. Favor concise, useful ICP, vertical, competitor, and event search query output. Do not claim live browsing.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Company domain: ${domain}\nTarget geography: ${geography}`,
            },
          ],
        },
      ],
      max_output_tokens: maxOutputTokens,
      reasoning: { effort: "low" },
      store: false,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "b2b_event_fit_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              company_name: { type: "string" },
              one_liner: { type: "string" },
              industry: { type: "string" },
              product_category: { type: "string" },
              icp: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              verticals: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              competitors: {
                type: "array",
                items: { type: "string" },
                minItems: 0,
                maxItems: 6,
              },
              event_fit_score: {
                type: "integer",
                minimum: 0,
                maximum: 100,
              },
              score_rationale: { type: "string" },
              recommended_event_types: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 6,
              },
              search_queries: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 8,
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
            },
            required: [
              "company_name",
              "one_liner",
              "industry",
              "product_category",
              "icp",
              "verticals",
              "competitors",
              "event_fit_score",
              "score_rationale",
              "recommended_event_types",
              "search_queries",
              "confidence",
            ],
          },
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return raiseOpenAiError(response.status, data);
  }

  const outputText = extractOutputText(data);
  const analysis = parseJson(outputText, null);

  if (!analysis) {
    throw new Error("OpenAI returned an empty or invalid analysis payload.");
  }

  return {
    analysis,
    model,
    usage: data.usage || null,
  };
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

function toProfile(analysis) {
  return {
    companyName: analysis.company_name,
    oneLiner: analysis.one_liner,
    industry: analysis.industry,
    productCategory: analysis.product_category,
    icp: analysis.icp,
    verticals: analysis.verticals,
    competitors: analysis.competitors,
    eventFitScore: analysis.event_fit_score,
    scoreRationale: analysis.score_rationale,
    recommendedEventTypes: analysis.recommended_event_types,
    confidence: analysis.confidence,
  };
}

async function recordAnalytics(db, eventName, properties) {
  await db
    .prepare(
      `INSERT INTO analytics_events (id, event_name, properties_json)
       VALUES (?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), eventName, JSON.stringify(properties))
    .run();
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function raiseOpenAiError(status, data) {
  const message = data?.error?.message || "OpenAI analysis failed.";
  const error = new Error(message);
  error.status = status;
  throw error;
}

export default app;
