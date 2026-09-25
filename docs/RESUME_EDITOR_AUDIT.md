# Resume editor audit

Audit of the HRYantra CV popup before the DOCX tab was added. Paths are under `hrayntra_aws`.

## 1. Current architecture

```text
Candidate profile / job drawer / submit-to-client
  CandidateProfileDrawer.tsx, JobDetailsDrawer.tsx, SubmitToClientDrawer.tsx
        ↓
useSaasaCvAnnotations (src/hooks/useSaasaCvAnnotations.tsx)
        ↓
SaasaCvAnnotationModal (src/components/candidates/SaasaCvAnnotationModal.tsx)
        ↓
PDF resume: PDF.js render + in-place HTML text layer
Word resume: GET /api/resume-word-pdf
             Microsoft Word exports a PDF
             PDF.js shows that page
             Edit text writes OOXML, then Word exports the page again
        ↓
Save
  filesApiUpload → POST /api/v1/files  (auth + x-tenant-db-name)
  apiUpdateCandidate sets candidate.resume to the new file URL
        ↓
S3 object (new key; previous object is left in place)
```

### Frontend

| Piece | File |
| --- | --- |
| Candidate page and table | `frontphase2/src/app/candidate/page.tsx` and candidate table components |
| Candidate drawer | `frontphase2/src/components/drawers/CandidateProfileDrawer.tsx` |
| CV popup | `SaasaCvAnnotationModal.tsx` |
| Open / save hook | `useSaasaCvAnnotations.tsx` |
| Word bytes proxy | `frontphase2/src/app/api/resume-docx/route.ts` |
| Word-to-PDF | `frontphase2/src/app/api/resume-word-pdf/route.ts`, `src/lib/convertWordResumeToPdf.ts` |
| Word text replace | `frontphase2/src/app/api/resume-word-edit/route.ts`, `src/lib/editDocxText.ts` |
| PDF text overlay | `src/lib/saasaCvPdfTextLayer.ts` |
| Upload | `filesApiUpload` in `src/lib/api.ts` |

There is no separate “Edit Resume” route. Edit is the HRYantra CV popup opened from the candidate, job, and submit-to-client flows.

### Backend

| Piece | File |
| --- | --- |
| Resume bytes | `GET /api/v1/resume-preview/bytes` in `backendphase2/src/routes/resumePreview.routes.js` |
| Controller | `backendphase2/src/controllers/resumePreview.controller.js` reads the S3 object |
| Candidate resume field | `candidate.resume` / `candidate.resumeUrl` in `candidate.service.js` |
| File upload | existing `POST /api/v1/files` used by `filesApiUpload` |
| Database | MongoDB candidate document. No Prisma `ResumeDocument` model. |

`resume-preview` is a server-to-server fetch from Next and does not take the user JWT. The popup’s save path does: `filesApiUpload` sends the session and tenant header, then the candidate update uses the existing candidate API.

## 2. Current problems

For a Word resume, the popup did all of the following:

| Mechanism | Present |
| --- | --- |
| HTML overlay editing | Yes for real PDFs (`saasa-pdf-inplace-layer`). Word files strip that layer. |
| Extracted text editing | Yes. A click reads PDF.js text and sends that string back. |
| DOCX XML manipulation | Yes. `editDocxText.ts` rewrites `w:t` runs. |
| Background DOCX modification | Yes. `POST /api/resume-word-edit`. |
| PDF rendering | Yes. Word `SaveAs` PDF, then PDF.js. |
| Image rendering | Yes for image resumes. |
| Word conversion | Yes. A hidden Word process exports every redraw. |
| Browser-only editing | The click-to-edit input is browser-only. It is not Word. |
| Server-side rendering of the page | The PDF route runs on the Next server and calls Word. |
| iframe / Office Online | Not used for editing. |
| Custom editor | Yes. Paint tools plus one line input. |
| Temporary files | Yes. `%TEMP%/hryantra-word-pdf`. |
| Asynchronous full-page render after each edit | Yes. That redraw was about 2–6 seconds. |

The words were written into the `.docx`, but the recruiter was not editing the document. They edited one reconstructed line, then waited for Word to draw the page again.

## 3. Requirement gap

Measured against the old popup, before the DOCX tab:

| Requirement | Result |
| --- | --- |
| Actual DOCX editing | FAIL |
| Actual document loaded into an editor | FAIL |
| Word-like editing | FAIL |
| Real formatting, pages, images, tables, headings, fonts, alignment | PARTIAL — shown by converting to PDF, not edited as a document |
| Bold / italic / underline / lists | FAIL |
| Undo / redo inside the document | FAIL for Word text. Paint undo exists. |
| Keyboard shortcuts and normal selection | FAIL |
| Direct text editing | FAIL — one line at a time |
| Save produces a `.docx` | PASS for the XML path, after Save |
| Reopen loads the saved `.docx` | PASS — `candidate.resume` points at the new S3 object |
| No browser text overlay | PASS for Word, FAIL for PDF resumes |
| No fake reconstructed resume | FAIL — the page is a Word PDF plus a painted line |
| Existing candidate / resume flow preserved | PASS |

PDF resumes are a separate path and stay on the in-place text layer.

## 4. Files that must change

- `frontphase2/src/components/candidates/SaasaCvAnnotationModal.tsx` — PDF / DOCX tabs
- `frontphase2/src/components/candidates/ResumeDocxEditor.tsx` — new editor
- `frontphase2/src/hooks/useSaasaCvAnnotations.tsx` — save the exported `.docx` with the existing upload
- `frontphase2/package.json` — `superdoc`

## 5. Files that must not change

Leave these alone:

- Candidate search, filters, and pagination
- Candidate profile fields and resume parsing
- AI matching
- Activity history
- Client review and submit-to-client field lists
- PDF in-place text editing for real PDF resumes
- Paint, notes, and logo tools on the PDF tab
- `filesApiUpload` auth and tenant header
- Candidate ownership checks on the candidate update API
