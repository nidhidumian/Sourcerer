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

  const cached = await getCachedEvents(c.env.DB, search.id);

  if (cached) {
    return c.json({
      searchId: search.id,
      domain: search.domain,
      geography: search.geography,
      cached: true,
      createdAt: cached.created_at,
      events: parseJson(cached.events_json, []),
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

  const queries = buildEventQueries(
    parseJson(search.queries_json, []),
    search.geography,
    toPositiveInteger(c.env.EXA_EVENTS_MAX_QUERIES, DEFAULT_EXA_EVENTS_MAX_QUERIES),
  );

  if (queries.length === 0) {
    return c.json({ error: "No search queries are available for this analysis." }, 422);
  }

  let events;

  try {
    events = await searchExaEvents(c.env, queries, search.geography);
  } catch (error) {
    return c.json(
      { error: error.message || "Exa events search failed." },
      error.status || 502,
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO events_cache (id, search_id, domain, geography, events_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      search.id,
      search.domain,
      search.geography,
      JSON.stringify(events),
    )
    .run();

  await recordAnalytics(c.env.DB, "events_exa_call", {
    domain: search.domain,
    geography: search.geography,
    searchId: search.id,
    queryCount: queries.length,
    eventCount: events.length,
  });

  return c.json({
    searchId: search.id,
    domain: search.domain,
    geography: search.geography,
    cached: false,
    events,
    budget: {
      monthlyLimit: budget.limit,
      callsRemainingAfterThis: Math.max(0, budget.remaining - 1),
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
        `SELECT id, domain, geography, queries_json
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
      `SELECT id, domain, geography, queries_json
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
    const query = new RegExp(escapeRegExp(geography), "i").test(base)
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

async function searchExaEvents(env, queries, geography) {
  const numResults = toPositiveInteger(
    env.EXA_RESULTS_PER_QUERY,
    DEFAULT_EXA_RESULTS_PER_QUERY,
  );
  const maxEvents = toPositiveInteger(env.EXA_MAX_EVENTS, DEFAULT_EXA_MAX_EVENTS);

  const responses = await Promise.all(
    queries.map((query) => requestExaSearch(env.EXA_API_KEY, query, numResults)),
  );

  const byUrl = new Map();

  for (const response of responses) {
    for (const result of response.results || []) {
      const event = toEventCard(result, geography);
      if (!event) {
        continue;
      }
      if (!byUrl.has(event.url)) {
        byUrl.set(event.url, event);
      }
    }
  }

  return Array.from(byUrl.values()).slice(0, maxEvents);
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
            "Extract the B2B event's name, its date or date range, and its location (city, country). Set isEvent to false if the page is not about a specific real-world or virtual event.",
          schema: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              eventName: { type: "string", description: "The event name" },
              date: { type: "string", description: "Event date or date range" },
              location: { type: "string", description: "City and country" },
              isEvent: {
                type: "boolean",
                description: "Whether the page describes a specific event",
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

function toEventCard(result, geography) {
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
    date: cleanText(summary?.date) || null,
    location: cleanText(summary?.location) || geography,
    url,
  };
}

function cleanText(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed || /^(unknown|n\/?a|none|null)$/i.test(trimmed)) {
    return "";
  }
  return trimmed;
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
