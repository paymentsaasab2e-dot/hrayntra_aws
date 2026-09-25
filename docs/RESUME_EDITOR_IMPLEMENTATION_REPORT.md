# Resume editor implementation report

## Before

The HRYantra CV popup turned a Word resume into a PDF with Microsoft Word, then let the recruiter change one reconstructed line. That line was written into the `.docx` XML, and Word drew the whole page again before the change showed.

## Problem

The recruiter was not editing the Word document. Every change waited on a full Word export.

## After

A `.docx` resume in the HRYantra CV popup has two tabs:

- **PDF** — the previous page, paint tools, and line edit. Unchanged.
- **DOCX** — SuperDoc opens the real `.docx`. The recruiter clicks into the document and uses SuperDoc’s toolbar. Typing does not export or redraw the file. **Save Resume** exports a `.docx` and uploads it through the existing candidate file API. `candidate.resume` then points at that new file.

Real PDF resumes do not get a DOCX tab.

## Editor selected

SuperDoc 2.17.0 (`superdoc`). Browser OOXML editor. No document server.

## Files changed

Frontend:

- `frontphase2/src/components/candidates/ResumeDocxEditor.tsx`
- `frontphase2/src/components/candidates/SaasaCvAnnotationModal.tsx`
- `frontphase2/src/hooks/useSaasaCvAnnotations.tsx`
- `frontphase2/src/types/superdoc-css.d.ts`
- `frontphase2/package.json` and `pnpm-lock.yaml` (`superdoc`)

Docs:

- `docs/RESUME_EDITOR_AUDIT.md`
- `docs/RESUME_EDITOR_ARCHITECTURE.md`

No backend or database files were changed.

## APIs

No new API.

Save uses the existing `POST /api/v1/files` upload and the existing candidate update that sets `candidate.resume`.

Load uses the existing `GET /api/resume-docx` proxy to `GET /api/v1/resume-preview/bytes`.

## Security

- The browser never receives S3 credentials.
- Upload still sends the session and tenant header.
- The exported blob is rejected unless it is a ZIP larger than 1000 bytes.
- There is no external save callback.
- A new S3 object is stored on each save. The previous object is left in place. `candidate.resume` is the current file.

## Performance

The DOCX tab loads the file once. Edits stay inside SuperDoc. Word is not started on each keystroke. The PDF tab still uses the old Word redraw if that tab’s line edit is used.

## Tests

`pnpm exec tsc --noEmit` was run.

- `ResumeDocxEditor.tsx` is clean after declaring `superdoc/style.css`.
- Three existing errors remain in `src/lib/docxPreviewLayout.ts` (`Uint8Array` is not a `BlobPart`). They were not part of this change.

The app has no frontend test runner, so the access, tenant, and persistence cases were not executed as automated tests.

The dev server compiled the popup (`Compiled in 103.9s` while bundling the editor) with no syntax error.

## Manual verification

The DOCX tab is mounted in `SaasaCvAnnotationModal` for `.docx` resumes. PDF resumes do not get that tab. The PDF tab is the previous paint and line editor.

Opening a `.docx` in the popup shows the Word pages in the window. SuperDoc’s ruler is off, because its padding pushed the page tens of thousands of pixels to the right and the window only showed the gray margin. Open → edit → Save Resume → close → reopen was not run while logged in. Signing in from this session would replace the recruiter’s login.

## Known limitations

- SuperDoc is AGPL-3.0. A commercial license is required before this is shipped as a proprietary product.
- The DOCX tab is for `.docx` only. Older `.doc` files stay on the PDF tab.
- Phone-width screens use the editor’s own scroll inside the popup.
- Paint annotations on the PDF tab are not written into the DOCX tab’s file. Save on the DOCX tab stores the SuperDoc document.
