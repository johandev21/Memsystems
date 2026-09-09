# Architecture

## Web ingestion via Firecrawl Cloud

Web URL ingestion runs through Firecrawl Cloud over HTTPS. The app talks to
it only through `FIRECRAWL_API_URL` (default `https://api.firecrawl.dev`)
with `FIRECRAWL_API_KEY` (get one at https://firecrawl.dev — required, Cloud
rejects keyless requests) and `FIRECRAWL_TIMEOUT_MS`. See `compose.dev.yml` /
`compose.prod.yml` passthrough and `GET /api/health/crawler`.

Costs: one credit per scraped page. The health check reads the free
`/team/credit-usage` endpoint (proves connectivity and key validity, spends
nothing); only an explicit `?probe=true` performs a real scrape (1 credit).

`SourcePolicyService` validates and normalizes every URL BEFORE any Firecrawl
call (allowlist, SSRF/DNS checks) — this also saves credits by rejecting junk
links before they cost anything. YouTube URLs and uploaded files never reach
Firecrawl: YouTube stays in the local acquisition adapter, files stay in local
extraction/normalization.

There is no local Firecrawl stack: the old self-hosted Compose overlay was
deleted. To go back you would need to re-add it; the app code only needs
`FIRECRAWL_API_URL` pointed at it.
