import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadPath = path.join(root, 'src/components/drawers/LeadDetailsDrawer.tsx');
const clientPath = path.join(root, 'src/components/drawers/ClientDetailsDrawer.tsx');

let lead = fs.readFileSync(leadPath, 'utf8');
let client = fs.readFileSync(clientPath, 'utf8');
const nl = lead.includes('\r\n') ? '\r\n' : '\n';

const kycAddLead = `${nl}                        <motion.div>${nl}                          <KycDocumentsField${nl}                            pendingFiles={pendingAddLeadKycFiles}${nl}                            onPendingFilesChange={setPendingAddLeadKycFiles}${nl}                            uploading={uploadingKyc}${nl}                            disabled={uploadingAgreements}${nl}                          />${nl}                        </motion.div>`.replace(/motion\.div/g, 'div');

const kycEditLead = `${nl}                            <motion.div className="md:col-span-2">${nl}                              <KycDocumentsField${nl}                                pendingFiles={pendingOverviewKycFiles}${nl}                                onPendingFilesChange={setPendingOverviewKycFiles}${nl}                                storedFiles={leadKycFiles}${nl}                                onRemoveStored={async (fileId) => {${nl}                                  await deleteLeadFile(fileId);${nl}                                  await refetchLeadFiles();${nl}                                }}${nl}                                uploading={uploadingKyc}${nl}                                disabled={uploadingAgreements}${nl}                              />${nl}                            </motion.div>`.replace(/motion\.div/g, 'div');

const kycViewLead = `${nl}                          <KycDocumentsView files={leadKycFiles} />${nl}`;

// Lead add form
{
  const ref = lead.indexOf('addLeadAgreementsInputRef');
  const close = lead.indexOf(`                      </motion.div>${nl}                    )}${nl}                  </section>`, ref);
  if (ref > 0 && close > 0 && !lead.slice(ref, close).includes('KycDocumentsField')) {
    lead = lead.slice(0, close) + kycAddLead + lead.slice(close);
    console.log('OK lead-add-kyc-ui');
  }
}

// Lead overview edit
{
  const ref = lead.indexOf('overviewAgreementsInputRef');
  const close = lead.indexOf(`                        )}${nl}                      </motion.div>${nl}                    )}${nl}                  </section>`, ref);
  if (ref > 0 && close > 0 && !lead.slice(ref, close).includes('pendingOverviewKycFiles')) {
    lead = lead.slice(0, close) + kycEditLead + lead.slice(close);
    console.log('OK lead-edit-kyc-ui');
  }
}

// Lead view
{
  const ref = lead.indexOf('{lead?.agreementsFileUrl && (');
  const close = lead.indexOf('{Array.isArray(lead?.otherDetails)', ref);
  if (ref > 0 && close > 0 && !lead.slice(ref, close).includes('KycDocumentsView')) {
    lead = lead.slice(0, close) + kycViewLead + lead.slice(close);
    console.log('OK lead-view-kyc');
  }
}

if (!lead.includes('setPendingAddLeadKycFiles([])')) {
  lead = lead.replace(
    'setPendingAddLeadAgreementsFile(null);',
    'setPendingAddLeadAgreementsFile(null);\n    setPendingAddLeadKycFiles([]);',
  );
  console.log('OK lead-reset-kyc-add');
}

fs.writeFileSync(leadPath, lead);

// Client
const cnl = client.includes('\r\n') ? '\r\n' : '\n';
const kycAddClient = `${cnl}                        <motion.div>${cnl}                          <KycDocumentsField${cnl}                            pendingFiles={pendingKycFiles}${cnl}                            onPendingFilesChange={setPendingKycFiles}${cnl}                            uploading={uploadingKyc}${cnl}                            disabled={uploadingAgreements}${cnl}                          />${cnl}                        </motion.div>`.replace(/motion\.div/g, 'div');

if (!client.includes("from '../documents/KycDocumentsField'")) {
  client = client.replace(
    "import { CscLocationFields } from '../location/CscLocationFields';",
    "import { CscLocationFields } from '../location/CscLocationFields';\nimport { KycDocumentsField, KycDocumentsView } from '../documents/KycDocumentsField';\nimport { filterKycFiles, uploadKycDocuments } from '../../lib/kycDocuments';",
  );
  console.log('OK client-imports');
}

if (!client.includes('pendingKycFiles')) {
  client = client.replace(
    'const [pendingAgreementsFile, setPendingAgreementsFile] = useState<File | null>(null);',
    'const [pendingAgreementsFile, setPendingAgreementsFile] = useState<File | null>(null);\n  const [pendingKycFiles, setPendingKycFiles] = useState<File[]>([]);',
  );
  client = client.replace(
    'const [uploadingAgreements, setUploadingAgreements] = useState(false);',
    'const [uploadingAgreements, setUploadingAgreements] = useState(false);\n  const [uploadingKyc, setUploadingKyc] = useState(false);',
  );
  console.log('OK client-state');
}

if (!client.includes('clientKycFiles')) {
  client = client.replace(
    "} = useFiles('client', client?.id);",
    "} = useFiles('client', client?.id);\n  const clientKycFiles = useMemo(() => filterKycFiles(clientFiles), [clientFiles]);",
  );
  client = client.replace(
    'uploadFile, deleteFile } = useFiles',
    'uploadFile, deleteFile, fetchFiles: refetchClientFiles } = useFiles',
  );
  console.log('OK client-kyc-files-memo');
}

if (!client.includes("uploadKycDocuments('client', createdClientId")) {
  client = client.replace(
    `setPendingAgreementsFile(null);${cnl}        onClientCreated?.();${cnl}        onClose();`,
    `setPendingAgreementsFile(null);${cnl}        if (createdClientId && pendingKycFiles.length > 0) {${cnl}          try {${cnl}            setUploadingKyc(true);${cnl}            await uploadKycDocuments('client', createdClientId, pendingKycFiles);${cnl}          } catch (uploadError: any) {${cnl}            console.error('Failed to upload client KYC documents:', uploadError);${cnl}            void requestError(uploadError.message || 'Failed to upload KYC documents');${cnl}          } finally {${cnl}            setUploadingKyc(false);${cnl}          }${cnl}        }${cnl}        setPendingKycFiles([]);${cnl}        onClientCreated?.();${cnl}        onClose();`,
  );
  console.log('OK client-create-kyc');
}

if (!client.includes("uploadKycDocuments('client', client.id")) {
  client = client.replace(
    `setPendingAgreementsFile(null);${cnl}        onClientCreated?.();${cnl}        setOverviewEditMode(false);`,
    `setPendingAgreementsFile(null);${cnl}        if (pendingKycFiles.length > 0) {${cnl}          try {${cnl}            setUploadingKyc(true);${cnl}            await uploadKycDocuments('client', client.id, pendingKycFiles);${cnl}            await refetchClientFiles();${cnl}          } catch (uploadError: any) {${cnl}            console.error('Failed to upload client KYC documents:', uploadError);${cnl}            void requestError(uploadError.message || 'Failed to upload KYC documents');${cnl}          } finally {${cnl}            setUploadingKyc(false);${cnl}          }${cnl}        }${cnl}        setPendingKycFiles([]);${cnl}        onClientCreated?.();${cnl}        setOverviewEditMode(false);`,
  );
  console.log('OK client-update-kyc');
}

{
  const ref = client.indexOf('// ── Add Client form');
  const ag = client.indexOf('agreementsInputRef', ref);
  const close = client.indexOf(`                      </motion.div>${cnl}                    </section>`, ag);
  if (ag > 0 && close > 0 && !client.slice(ag, close).includes('KycDocumentsField')) {
    client = client.slice(0, close) + kycAddClient + client.slice(close);
    console.log('OK client-add-kyc-ui');
  }
}

{
  const ref = client.indexOf('(fullClientData?.agreementsFileUrl || client?.agreementsFileUrl)');
  const close = client.indexOf(`                          </>${cnl}`, ref);
  if (ref > 0 && close > 0 && !client.slice(ref, close).includes('KycDocumentsView')) {
    client = client.slice(0, close) + `${cnl}                            <KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />` + client.slice(close);
    console.log('OK client-view-kyc');
  }
}

fs.writeFileSync(clientPath, client);
console.log('done');
