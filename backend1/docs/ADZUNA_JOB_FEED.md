# Adzuna XML Job Feed

This project supplies **our own published jobs** to Adzuna through a dynamic XML feed. That is not the Adzuna Search API.

- Search API (`ADZUNA_APP_ID` / `ADZUNA_APP_KEY`) can read Adzuna’s jobs. It cannot post ours.
- The XML feed is generated from MongoDB on each request. Adzuna crawls that URL after they accept it.

This feed is **not live on Adzuna** until their team is given the public HTTPS URL and they ingest it.

## Feed endpoint

Canonical (job portal API, port 5000):

```
GET /api/adzuna/jobs.xml
```

Local:

```
http://localhost:5000/api/adzuna/jobs.xml
```

This URL is public. No token, login, or query parameter is required.

Aliases (same XML, do not use in Adzuna onboarding if the canonical URL works):

- `GET /api/jobs/adzuna.xml` (backend1)
- `GET /api/v1/adzuna/jobs.xml` (Phase 2, port 5001)
- `GET /api/v1/jobs/adzuna.xml` (Phase 2)

Content-Type: `application/xml; charset=UTF-8`

The XML never contains Application ID or Application Key.

## Public job URL

`<url>` uses the candidate portal deep link:

```
https://www.hryantra.com/explore-jobs?job={jobId}&utm_source=adzuna
```

Override with `JOB_PORTAL_FRONTEND_URL` (must be public HTTPS). Localhost is never written into the feed.

## Which jobs are exported

A job is exported when it is currently listable on the public job portal:

1. Portal Mongo `jobs` collection
2. Not deleted (`isDeleted` is not true)
3. Not inactive (`isActive` is not false, status is not `INACTIVE` / `PAUSED`)
4. Status is not `DRAFT`, `ON_HOLD`, `CLOSED`, `FILLED`, `REJECTED`, or `UNPUBLISHED`
5. `expectedClosureDate` is missing or still in the future
6. Required fields: id, title, description, public HTTPS URL, location, country, company

The Create Job Adzuna checkbox is unchanged in the UI. It is **not** required for the public feed unless `ADZUNA_FEED_REQUIRE_OPT_IN=true`.

Closed, filled, draft, deleted, expired, rejected, unpublished, and inactive jobs disappear automatically because the XML is generated live from Mongo on each request. There is no static `jobs.xml` file and no 2,000-job cap.

Admin diagnostics (not public): `GET /api/internal/job-feeds/diagnostics` with `x-internal-admin-key`.

## XML fields

| XML tag | Source | Notes |
|---|---|---|
| title | `Job.title` | Required |
| id | `Job.id` | Mongo ObjectId |
| description | `description` plus responsibilities/requirements HTML | CDATA |
| url | explore-jobs deep link | Required |
| location | `city` or `location` or `state` | Required |
| country | `country` mapped to ISO (India → `IN`) | Required; skipped if unknown |
| company | `Client.companyName` or `Company.name` | Omitted when client name is hidden |
| category | mapped Adzuna category id | Omitted if unmapped |
| salary_min / salary_max | `salary.min/max` or `salaryMin` / `salaryMax` | Omitted if missing |
| salary_currency | `salary.currency` or `salaryCurrency` | |
| salary_frequency | hour / day / month / year | |
| contract_type | permanent / contract from `type` | |
| contract_time | full_time / part_time | |
| remote | `1` if work mode/location is remote | |
| date | `postedAt` / `postedDate` / `createdAt` | |
| geo_lat / geo_lng / postcode | only if present on the document | Schema has no lat/lng today |

## Category mapping

Internal `jobCategory` / `industry` / `department` / title are matched in `src/services/adzuna/categories.js`. Stored categories are not changed. Unmapped jobs are still exported without `<category>`, and a server log is written.

## Country mapping

Uses the job’s `country` when set. `India` and `IN` become `IN`. Other Adzuna countries use ISO codes (`US`, `UK`, …). If country is missing, the feed tries to infer it from location text. If it still cannot resolve a supported country, the job is skipped.

## Environment variables

Server only. Placeholders belong in `.env.example`, never commit real keys.

```
ADZUNA_APP_ID=          # Search API only; not used by the XML feed
ADZUNA_APP_KEY=         # Search API only; not used by the XML feed
ADZUNA_COUNTRY=in       # Search API country hint only
ADZUNA_FEED_REQUIRE_OPT_IN=false
JOB_PORTAL_FRONTEND_URL=https://www.hryantra.com
```

## How to test locally

1. Restart backend1 so it loads the new route (`pnpm dev` in `hrayntra_aws/backend1`).
2. Open `http://localhost:5000/api/adzuna/jobs.xml`.
3. Confirm `Content-Type: application/xml` and a `<jobs>` root.
4. Publish a job in Phase 2 with Adzuna ticked, then refresh the feed.
5. Run unit tests: `pnpm test:adzuna` from `hrayntra_aws/backend1`.

## How to test after deployment

Use the public HTTPS API host, for example:

```
https://YOUR_BACKEND1_HOST/api/adzuna/jobs.xml
```

Adzuna cannot crawl `localhost`.

## How to give the feed to Adzuna

After the HTTPS URL returns valid XML:

1. Send the URL to Adzuna ATS / job-feed onboarding.
2. They crawl at least daily.
3. Job edits show up on the next crawl. Closed or deleted jobs drop out of the XML, so they should drop from Adzuna after ingest.

Do not put Application ID or Application Key in the feed URL.
