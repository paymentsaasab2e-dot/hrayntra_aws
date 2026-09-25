# Resume editor architecture

## Chosen editor

SuperDoc `2.17.0` (`superdoc` on npm), mounted in the HRYantra CV popup on a **DOCX** tab.

The editor reads the `.docx` package, keeps an OOXML document model, and `export({ exportType: ['docx'], triggerDownload: false })` writes a `.docx` blob. The recruiter clicks into the document and uses SuperDoc’s own toolbar (undo, redo, fonts, bold, italic, lists, alignment). This app does not draw a fake toolbar or an HTML text layer on that tab.

## Why chosen

- It edits a real `.docx` in the browser.
- It does not need a document server, Microsoft 365, or a Word process on each keystroke.
- The document is loaded once when the DOCX tab opens. Save runs only when the recruiter presses Save Resume.
- ONLYOFFICE was rejected because it needs a Document Server that can fetch the file, plus a callback URL. This app runs on localhost and stores resumes in private S3.
- Microsoft Word for the Web was rejected. There is no Microsoft 365 / OneDrive / SharePoint app registration, and an iframe embed cannot edit a private S3 file.
- The previous XML line replace plus Word PDF redraw stays available only on the **PDF** tab, unchanged. It is not the DOCX editor.

## Frontend integration

`ResumeDocxEditor` loads bytes from `/api/resume-docx` (the existing proxy to `GET /api/v1/resume-preview/bytes`) and passes a `File` to `new SuperDoc({ selector, toolbar, document, documentMode: 'editing', contained: true })`.

The CV popup shows two tabs only when the resume URL is a `.docx`:

- **PDF** — the existing Word-rendered page, paint tools, and line edit.
- **DOCX** — SuperDoc. The paint sidebar is hidden on this tab.

Real PDF resumes do not get a DOCX tab.

## Backend integration

No new candidate route. Save reuses:

1. SuperDoc exports a `.docx` blob in the browser.
2. `filesApiUpload('candidate', candidateId, file, 'Other')` → `POST /api/v1/files` with the session and `x-tenant-db-name`.
3. The existing candidate update sets `candidate.resume` to the uploaded URL.

## Storage integration

Each save uploads a new S3 object. The previous object is not deleted. `candidate.resume` becomes the new URL, so the next open and the PDF preview use the new file. The Word PDF cache key is the resume URL, so the old preview is not reused for the new file.

## Authentication

The editor does not receive S3 credentials. Bytes are loaded through the existing resume-bytes proxy. Save uses the same authenticated file upload and candidate update as the rest of the CV popup.

## Tenant isolation

`filesApiUpload` already sends `x-tenant-db-name`. The candidate update goes through the existing candidate API, which checks the signed-in user and tenant. The client `candidateId` is not trusted by itself on that API.

## Save mechanism

DOCX tab → `editor.export` → reject the blob unless it is a ZIP package larger than 1000 bytes → upload → update `candidate.resume` → toast “Resume saved successfully.” → close the popup.

Success is shown only after the upload and candidate update return. A failed export or upload shows “Unable to save the resume. Your changes have not been lost. Please try again.” and leaves the popup open.

## Failure handling

| State | Message |
| --- | --- |
| Opening the editor | Loading resume editor... |
| Load failure | Unable to load this resume. Please try again. |
| Saving | Saving resume... |
| Saved | Resume saved successfully. |
| Save failed | Unable to save the resume. Your changes have not been lost. Please try again. |

The backdrop and close button do not dismiss the popup while a save is in progress.

## Versioning

No new collection. The uploaded object uses a new storage key, and `candidate.resume` points at the current file. Older keys remain in S3. There is no resume-version list in the UI.

## Security

- Private storage keys stay on the server.
- The exported file must start with the ZIP local-file header (`PK`).
- Save cannot target another tenant without passing the existing file and candidate APIs.
- SuperDoc has no save webhook, so there is no external callback that could overwrite another resume.

## Deployment requirements

- `superdoc` is a frontend dependency. No extra container.
- License: SuperDoc is AGPL-3.0. A proprietary production deployment needs a SuperDoc commercial license before the product is shipped. https://www.superdocportal.dev/get-in-touch

## Environment variables

None added. Resume bytes and uploads keep using the existing API base URL and tenant header.

## Layout

The DOCX tab uses SuperDoc contained mode so the document scrolls inside the popup on desktop, laptop, and tablet. A very narrow phone screen uses that same scroll. There is no separate mobile editor.
