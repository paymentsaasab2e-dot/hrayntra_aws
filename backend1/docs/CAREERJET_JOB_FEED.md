# Careerjet XML Job Feed

This project supplies **our own published jobs** to Careerjet through a dynamic XML feed.

It is **not** the Careerjet Search API (`https://search.api.careerjet.net/v4/query`). That API is for displaying Careerjet’s jobs on a publisher site. This feed is the opposite: our jobs, for Careerjet to crawl.

Jobs are **not live on Careerjet** until Careerjet reviews and ingests the HTTPS feed URL.

Official format used: [Careerjet XML Feed](https://www.careerjet.com/docs/feeds/xml)

## Feed URL

Canonical (job portal API, port 5000):

```
GET /api/careerjet/jobs.xml
```

Local:

```
http://localhost:5000/api/careerjet/jobs.xml
```

Public. No JWT, no token query parameter.

Alias: `GET /api/v1/careerjet/jobs.xml` on Phase 2 (port 5001).

Content-Type: `application/xml; charset=UTF-8`

The XML never contains API keys or passwords.

## Job eligibility

Exported only when all of these are true:

1. Job exists in the portal Mongo `jobs` collection
2. Not deleted (`isDeleted` is not true)
3. Not inactive (`isActive` is not false)
4. Status is not `DRAFT`, `ON_HOLD`, `CLOSED`, or `FILLED`
5. `expectedClosureDate` is missing or still in the future
6. Careerjet is enabled: `publishToCareerjet === true` or `distributionPlatforms.careerjet === true`
7. Required fields: id, title, description, public URL, location, country

Closed, filled, draft, deleted, expired, and Careerjet-disabled jobs drop out of the next request automatically. The feed is generated from Mongo on every GET.

Enable Careerjet on **Create Job → External platforms → Careerjet**.

`CAREERJET_FEED_INCLUDE_ALL=true` lists every open portal job (not recommended).

## Public job URL

```
{JOB_PORTAL_FRONTEND_URL}/explore-jobs?job={jobId}&utm_source=careerjet
```

Local: `http://localhost:3000/explore-jobs?job=...`

Production feeds must use the public HTTPS portal host, not localhost. Set `JOB_PORTAL_FRONTEND_URL`.

## XML fields (Careerjet official schema)

| XML | Source | Notes |
|---|---|---|
| id | `Job.id` | CDATA |
| title | `Job.title` | CDATA |
| url | explore-jobs deep link | CDATA |
| location/city | `city` or `location` | nested |
| location/region | `state` | nested, omitted if empty |
| location/country | mapped full name | e.g. India, not IN |
| company | client/company name | omitted if hidden |
| company_url | client website | omitted if missing |
| description | HTML JD | CDATA |
| contract_type | mapped from `type` | permanent / contract / temporary / internship / volunteering |
| working_hours | mapped from `type` | full-time / part-time |
| salary | currency + min-max string | omitted if no salary |
| apply_url | same as url | apply on our portal |

Not included (Careerjet Easy Apply / sponsored, not this basic feed):

- `careerjet-apply-data` (needs a Careerjet-issued `apply_key`)
- `programmatic` bids
- Adzuna numeric category IDs (Careerjet’s published XML has no category tag)

## Country mapping

Uses the job’s country. `IN` / `India` → `India`. `UK` / `United Kingdom` → `United Kingdom`. Country is not hardcoded to India.

## Salary

From `Job.salary` JSON (`min`, `max`, `currency`) or legacy `salaryMin` / `salaryMax` / `salaryCurrency`. Example: `INR 600000 - 1000000`. Missing salary is omitted, never invented.

## Employment type

| Internal | contract_type | working_hours |
|---|---|---|
| FULL_TIME | permanent | full-time |
| PART_TIME | permanent | part-time |
| CONTRACT / FREELANCE | contract | full-time unless part |
| INTERNSHIP | internship | full-time unless part |
| TEMPORARY | temporary | full-time unless part |

## Security

No Careerjet Search API key is required for this feed. Do not put keys in XML, frontend, or git.

## Local testing

1. Restart backend1.
2. Open `http://localhost:5000/api/careerjet/jobs.xml`
3. Publish a job with Careerjet ticked, then refresh.
4. `pnpm test:careerjet` from `hrayntra_aws/backend1`

## Production / Careerjet review

1. Deploy backend1 on HTTPS.
2. Confirm `JOB_PORTAL_FRONTEND_URL` is the public portal.
3. Send `https://YOUR_API_HOST/api/careerjet/jobs.xml` to Careerjet ATS / feed review ([mediakit/ats](https://www.careerjet.com/mediakit/ats)).
4. They crawl at least daily. Jobs not in the feed are delisted.

## Known limitations

- Easy Apply (`careerjet-apply-data`) is not implemented; that needs a Careerjet `apply_key` during onboarding.
- Category is not in Careerjet’s published XML schema, so it is not emitted.
- Latitude, longitude, and postcode are not on our Job schema and are omitted.
