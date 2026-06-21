import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

const CACHE_TTL_HOURS = 24;
const DEFAULT_ANALYZE_MONTHLY_LIMIT = 300;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const DEFAULT_EXA_SEARCH_MONTHLY_LIMIT = 300;
const DEFAULT_EXA_EVENTS_MAX_QUERIES = 4;
const DEFAULT_EXA_RESULTS_PER_QUERY = 5;
const DEFAULT_EXA_MAX_EVENTS = 12;
const DEFAULT_EVENTS_LOOKAHEAD_MONTHS = 12;
const DEFAULT_EVENTS_CACHE_VERSION = "2";

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
    "america",
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

// Small curated flagship map. Each entry is a major recurring B2B event tied to a
// known country. It is shown as a TBD anchor only when its country matches the
// search geography AND its tags intersect the analyze output. Intentionally short.
const FLAGSHIP_EVENTS = [
  {
    name: "AWS re:Invent",
    organizer: "Amazon Web Services",
    url: "https://reinvent.awsevents.com/",
    country: "United States",
    priorYearDate: "Dec 2-6, 2024",
    priorYearLocation: "Las Vegas, United States",
    tags: ["cloud", "infrastructure", "devops", "developer", "security", "data", "saas", "ai"],
  },
  {
    name: "Google Cloud Next",
    organizer: "Google",
    url: "https://cloud.withgoogle.com/next",
    country: "United States",
    priorYearDate: "Apr 9-11, 2024",
    priorYearLocation: "Las Vegas, United States",
    tags: ["cloud", "developer", "data", "ai", "infrastructure"],
  },
  {
    name: "Microsoft Ignite",
    organizer: "Microsoft",
    url: "https://ignite.microsoft.com/",
    country: "United States",
    priorYearDate: "Nov 19-22, 2024",
    priorYearLocation: "Chicago, United States",
    tags: ["cloud", "security", "developer", "it", "infrastructure", "ai"],
  },
  {
    name: "Dreamforce",
    organizer: "Salesforce",
    url: "https://www.salesforce.com/dreamforce/",
    country: "United States",
    priorYearDate: "Sep 17-19, 2024",
    priorYearLocation: "San Francisco, United States",
    tags: ["saas", "sales", "crm", "marketing", "b2b"],
  },
  {
    name: "SaaStr Annual",
    organizer: "SaaStr",
    url: "https://www.saastrannual.com/",
    country: "United States",
    priorYearDate: "Sep 10-12, 2024",
    priorYearLocation: "San Mateo, United States",
    tags: ["saas", "sales", "b2b", "marketing", "startup"],
  },
  {
    name: "Money20/20 USA",
    organizer: "Money20/20",
    url: "https://www.money2020.com/",
    country: "United States",
    priorYearDate: "Oct 27-30, 2024",
    priorYearLocation: "Las Vegas, United States",
    tags: ["fintech", "payments", "finance", "banking", "b2b"],
  },
  {
    name: "HIMSS Global Health Conference",
    organizer: "HIMSS",
    url: "https://www.himssconference.com/",
    country: "United States",
    priorYearDate: "Mar 11-15, 2024",
    priorYearLocation: "Orlando, United States",
    tags: ["healthcare", "health", "medtech", "biotech", "life sciences"],
  },
  {
    name: "RSA Conference",
    organizer: "RSA",
    url: "https://www.rsaconference.com/",
    country: "United States",
    priorYearDate: "May 6-9, 2024",
    priorYearLocation: "San Francisco, United States",
    tags: ["security", "cybersecurity", "infosec", "it"],
  },
  {
    name: "Legalweek",
    organizer: "ALM",
    url: "https://www.event.law.com/legalweek",
    country: "United States",
    priorYearDate: "Jan 28-31, 2025",
    priorYearLocation: "New York, United States",
    tags: ["legal", "legaltech", "law", "compliance"],
  },
  {
    name: "Web Summit",
    organizer: "Web Summit",
    url: "https://websummit.com/",
    country: "Portugal",
    priorYearDate: "Nov 11-14, 2024",
    priorYearLocation: "Lisbon, Portugal",
    tags: ["tech", "startup", "saas", "b2b", "marketing"],
  },
  {
    name: "Collision",
    organizer: "Web Summit",
    url: "https://collisionconf.com/",
    country: "Canada",
    priorYearDate: "Jun 17-20, 2024",
    priorYearLocation: "Toronto, Canada",
    tags: ["tech", "startup", "saas", "b2b"],
  },
  {
    name: "London Tech Week",
    organizer: "London Tech Week",
    url: "https://londontechweek.com/",
    country: "United Kingdom",
    priorYearDate: "Jun 10-14, 2024",
    priorYearLocation: "London, United Kingdom",
    tags: ["tech", "startup", "saas", "b2b", "ai"],
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

  const budget = await getAnalyzeBudget(c.env.DB, c.env);

  if (budget.remaining <= 0) {
    return c.json(
      {
        error:
          "Analyze budget reached. Try again after cached results are available or raise OPENAI_ANALYZE_MONTHLY_LIMIT.",
      },
      429,
    );
  }

  let openAiResult;

  try {
    openAiResult = await requestOpenAiAnalysis(c.env, domain, geography);
  } catch (error) {
    return c.json(
      { error: error.message || "OpenAI analysis failed." },
      error.status || 502,
    );
  }

  const searchId = crypto.randomUUID();
  const profile = toProfile(openAiResult.analysis);
  const queries = openAiResult.analysis.search_queries;

  await c.env.DB.prepare(
    `INSERT INTO searches (id, domain, geography, profile_json, queries_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(searchId, domain, geography, JSON.stringify(profile), JSON.stringify(queries))
    .run();

  await recordAnalytics(c.env.DB, "analyze_openai_call", {
    domain,
    geography,
    model: openAiResult.model,
    searchId,
    usage: openAiResult.usage,
  });

  return c.json({
    searchId,
    domain,
    geography,
    cached: false,
    profile,
    queries,
    budget: {
      monthlyLimit: budget.limit,
      callsRemainingAfterThis: Math.max(0, budget.remaining - 1),
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
  const queries = buildEventQueries(
    parseJson(search.queries_json, []),
    search.geography,
    maxQueries,
  );

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
                description: "Key agenda topics or tracks",
              },
              speakers: {
                type: "array",
                items: { type: "string" },
                description: "Notable speakers, if listed",
              },
              sponsors: {
                type: "array",
                items: { type: "string" },
                description: "Sponsor or exhibitor company names, if listed",
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
    speakers: cleanTextArray(summary?.speakers),
    sponsors: cleanTextArray(summary?.sponsors),
    sponsorshipEmail:
      cleanEmail(summary?.sponsorshipEmail) || cleanEmail(summary?.contactEmail),
    url,
    source: "exa",
  };
}

// Apply the full quality pipeline: strict geography gate, date window, relevance
// (fail open), flagship anchors, grounded competitor line, sort, and cap.
function curateEvents(rawEvents, { geography, profile, lookaheadMonths, maxEvents }) {
  const byKey = new Map();
  const addEvent = (event) => {
    const key = (event.url || event.name).toLowerCase();
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

  // Relevance filter — fail open if it would empty the list.
  const relevanceTerms = buildRelevanceTerms(profile);
  if (relevanceTerms.length > 0) {
    const matched = events.filter(
      (event) =>
        event.source === "curated" || eventMatchesRelevance(event, relevanceTerms),
    );
    if (matched.length > 0) {
      events = matched;
    }
  }

  // Grounded competitor sponsors line — additive only.
  const competitors = toStringArray(profile.competitors);
  for (const event of events) {
    event._competitorSponsors = intersectCompetitors(competitors, event.sponsors);
  }

  // Sort chronologically; TBD / flagship pinned to the bottom.
  events.sort((a, b) => {
    const at = a._startDate ? a._startDate.getTime() : Number.POSITIVE_INFINITY;
    const bt = b._startDate ? b._startDate.getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  return events.slice(0, maxEvents).map(finalizeCard);
}

function curatedFlagships(profile, geography) {
  const terms = buildRelevanceTerms(profile);
  const recommended = toStringArray(profile.recommendedEventTypes)
    .join(" ")
    .toLowerCase();

  return FLAGSHIP_EVENTS.filter((flagship) => {
    if (canonicalCountry(flagship.country) !== canonicalCountry(geography)) {
      return false;
    }
    const tagHit = flagship.tags.some(
      (tag) => recommended.includes(tag) || terms.includes(tag),
    );
    const nameHit = recommended.includes(flagship.name.toLowerCase());
    return tagHit || nameHit;
  }).map((flagship) => ({
    name: flagship.name,
    organizer: flagship.organizer,
    description: "",
    city: "",
    country: flagship.country,
    startDate: "",
    dateText: "",
    isRecurring: true,
    priorYearDate: flagship.priorYearDate,
    priorYearLocation: flagship.priorYearLocation,
    agenda: [],
    speakers: [],
    sponsors: [],
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

  return {
    name: event.name,
    organizer: event.organizer || null,
    description: event.description || null,
    date: tbd ? "TBD" : event.dateText || formatEventDate(event._startDate),
    location: flagship ? "TBD" : locationKnown || "TBD",
    tbd,
    flagship,
    priorYear,
    agenda: (event.agenda || []).slice(0, 5),
    speakers: (event.speakers || []).slice(0, 5),
    competitorSponsors: event._competitorSponsors || [],
    sponsorshipEmail: event.sponsorshipEmail || null,
    url: event.url,
  };
}

function buildRelevanceTerms(profile) {
  const sources = [
    profile.industry,
    profile.productCategory,
    ...toStringArray(profile.icp),
    ...toStringArray(profile.verticals),
    ...toStringArray(profile.recommendedEventTypes),
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

function intersectCompetitors(competitors, sponsors) {
  if (!competitors.length || !sponsors.length) {
    return [];
  }

  const matched = [];
  for (const competitor of competitors) {
    const needle = normalizeCompany(competitor);
    if (!needle) {
      continue;
    }
    const hit = sponsors.find((sponsor) => {
      const hay = normalizeCompany(sponsor);
      return hay && (hay === needle || hay.includes(needle) || needle.includes(hay));
    });
    if (hit) {
      matched.push(competitor);
    }
  }

  return Array.from(new Set(matched));
}

function normalizeCompany(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|plc|sa|ag)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Returns "match" | "nonmatch" | "unknown" for the strict geography gate.
function geographyMatchState(event, geography) {
  const target = canonicalCountry(geography);
  const candidates = [event.country, event.city, event.location].filter(Boolean);

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

  // Confirmed non-match (resolves to a different known country).
  for (const candidate of candidates) {
    const canonical = canonicalCountry(candidate);
    if (target && canonical && canonical !== target) {
      return "nonmatch";
    }
  }

  return "unknown";
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
