# ADR-004: Client-review JWT and storage URL proxy

- **Status:** Accepted  
- **Date:** Codified 2026-09-17  
- **Phase:** 2  

## Context

Recruiters must share candidate packages with hiring clients without creating CRM accounts. Raw S3 URLs in the browser leak long-lived object access and bypass field visibility.

## Decision

1. Issue a **time-limited JWT** (≈14 days) and/or short code for client review.  
2. Embed interview / match / tenant context in the token.  
3. **Mask** S3 / internal upload URLs in the JSON payload to `/client-review/{token}/resume` and `/files/...`.  
4. Stream files through authenticated public review routes.  
5. Honour `cvShareMode` (`original` | `edited` | `saasa`) and tracker options (e.g. download resume).

## Consequences

**Positive**

- Clients never need CRM login.  
- Storage credentials stay server-side.  
- Visibility and share mode are enforceable server-side.

**Negative**

- Token theft within validity window is still sensitive (mitigate with short TTL, HTTPS, regenerate).  
- Proxy bandwidth on API hosts.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Presigned S3 URLs only | Harder to revoke; bypasses presentation controls |
| Magic-link email accounts | Heavier UX for one-off reviewers |
| Embed PDF in email | Size / security / outdated copies |
