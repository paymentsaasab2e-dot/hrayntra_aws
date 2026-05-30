# KYC pipeline test documents

Use these files to test **KYC auto-fill** in the client drawer (KYC Form section → Upload KYC documents).

| File | Purpose |
|------|---------|
| `SAASA_B2E_KYC_Form_TEST.xlsx` | Excel KYC form with label/value rows |
| `SAASA_B2E_KYC_Form_TEST.pdf` | Same data as PDF |

## Sample data included

- **Company:** SummitSphere Media Pvt Ltd (LLC, India)
- **Signatory:** Rajesh Kumar Mehta (Passport)
- **Shareholders:** Anita Desai (60%), Vikram Singh (40%)
- **Bank:** HDFC Bank, INR, IBAN/SWIFT

## Regenerate

```bash
cd backendphase2
node scripts/generate-kyc-test-documents.mjs
```

## Expected

After upload, terminal should show **KYC Pipeline** Stage 4 with many fields filled, and the form should populate sections 1–4 and declaration (review before saving).
