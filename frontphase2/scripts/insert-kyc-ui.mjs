import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nl = '\r\n';

function insertAfter(content, anchor, insert, label) {
  if (content.includes(insert.trim().slice(0, 55))) {
    console.log(`skip ${label}`);
    return content;
  }
  const i = content.indexOf(anchor);
  if (i < 0) {
    console.log(`FAIL ${label}`);
    return content;
  }
  console.log(`OK ${label}`);
  return content.slice(0, i + anchor.length) + insert + content.slice(i + anchor.length);
}

let lead = fs.readFileSync(path.join(root, 'src/components/drawers/LeadDetailsDrawer.tsx'), 'utf8');

lead = insertAfter(
  lead,
  `{pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}${nl}                            </button>${nl}                          </div>${nl}                        </div>${nl}                      </div>`,
  `${nl}                        <motion.div className="mt-4">${nl}                          <KycDocumentsField${nl}                            pendingFiles={pendingAddLeadKycFiles}${nl}                            onPendingFilesChange={setPendingAddLeadKycFiles}${nl}                            uploading={uploadingKyc}${nl}                            disabled={uploadingAgreements}${nl}                          />${nl}                        </div>`.replace(
    /motion\.div/g,
    'div',
  ),
  'lead-add-kyc',
);

lead = insertAfter(
  lead,
  `{overviewEditForm.agreementsFileUrl || pendingOverviewAgreementsFile ? 'Replace file' : 'Upload file'}${nl}                                </button>${nl}                              </div>${nl}                            </div>${nl}                          </div>`,
  `${nl}                            <div className="md:col-span-2">${nl}                              <KycDocumentsField${nl}                                pendingFiles={pendingOverviewKycFiles}${nl}                                onPendingFilesChange={setPendingOverviewKycFiles}${nl}                                storedFiles={leadKycFiles}${nl}                                onRemoveStored={async (fileId) => {${nl}                                  await deleteLeadFile(fileId);${nl}                                  await refetchLeadFiles();${nl}                                }}${nl}                                uploading={uploadingKyc}${nl}                                disabled={uploadingAgreements}${nl}                              />${nl}                            </div>`,
  'lead-edit-kyc',
);

lead = lead.replace(
  `<KycDocumentsView files={leadKycFiles} />${nl}{Array.isArray`,
  `<KycDocumentsView files={leadKycFiles} />${nl}${nl}{Array.isArray`,
);

if (!lead.includes('setPendingOverviewKycFiles([]);')) {
  lead = lead.replace(
    `setPendingOverviewAgreementsFile(null);${nl}    if (overviewAgreementsInputRef.current) overviewAgreementsInputRef.current.value = '';${nl}    setOverviewEditMode(true);`,
    `setPendingOverviewAgreementsFile(null);${nl}    setPendingOverviewKycFiles([]);${nl}    if (overviewAgreementsInputRef.current) overviewAgreementsInputRef.current.value = '';${nl}    setOverviewEditMode(true);`,
  );
  lead = lead.replace(
    `const cancelOverviewEdit = () => {${nl}    setOverviewEditMode(false);${nl}    setOverviewEditErrors({});${nl}    setPendingOverviewAgreementsFile(null);`,
    `const cancelOverviewEdit = () => {${nl}    setOverviewEditMode(false);${nl}    setOverviewEditErrors({});${nl}    setPendingOverviewAgreementsFile(null);${nl}    setPendingOverviewKycFiles([]);`,
  );
  console.log('OK lead-kyc-resets');
}

fs.writeFileSync(path.join(root, 'src/components/drawers/LeadDetailsDrawer.tsx'), lead);

let client = fs.readFileSync(path.join(root, 'src/components/drawers/ClientDetailsDrawer.tsx'), 'utf8');

client = insertAfter(
  client,
  `{pendingAgreementsFile ? 'Replace file' : 'Upload file'}${nl}                            </button>${nl}                          </div>${nl}                        </div>${nl}                      </div>${nl}                    </section>`,
  `${nl}                        <div className="mt-4">${nl}                          <KycDocumentsField${nl}                            pendingFiles={pendingKycFiles}${nl}                            onPendingFilesChange={setPendingKycFiles}${nl}                            uploading={uploadingKyc}${nl}                            disabled={uploadingAgreements}${nl}                          />${nl}                        </div>`,
  'client-add-kyc',
);

client = insertAfter(
  client,
  `{overviewEditForm.agreementsFileUrl || pendingAgreementsFile ? 'Replace file' : 'Upload file'}${nl}                                </button>${nl}                              </div>${nl}                            </div>${nl}                          </>`,
  `${nl}                            <div>${nl}                              <KycDocumentsField${nl}                                pendingFiles={pendingKycFiles}${nl}                                onPendingFilesChange={setPendingKycFiles}${nl}                                storedFiles={clientKycFiles}${nl}                                uploadsBase={uploadsBase}${nl}                                onRemoveStored={async (fileId) => {${nl}                                  await deleteFile(fileId);${nl}                                  await refetchClientFiles();${nl}                                }}${nl}                                uploading={uploadingKyc}${nl}                                disabled={uploadingAgreements}${nl}                              />${nl}                            </div>`,
  'client-edit-kyc',
);

client = client.replace(
  `<KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />                          </>`,
  `<KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />${nl}                          </>`,
);

if (!client.includes('setPendingKycFiles([]);')) {
  client = client.replace(
    `setPendingAgreementsFile(null);${nl}    setOverviewEditMode(true);`,
    `setPendingAgreementsFile(null);${nl}    setPendingKycFiles([]);${nl}    setOverviewEditMode(true);`,
  );
  client = client.replace(
    `const cancelOverviewEdit = () => {${nl}    setOverviewEditMode(false);${nl}    resetClientLogoDraft();${nl}    setPendingAgreementsFile(null);`,
    `const cancelOverviewEdit = () => {${nl}    setOverviewEditMode(false);${nl}    resetClientLogoDraft();${nl}    setPendingAgreementsFile(null);${nl}    setPendingKycFiles([]);`,
  );
  client = client.replace(
    `setPendingAgreementsFile(null);${nl}      // Set edit mode to true so form is visible`,
    `setPendingAgreementsFile(null);${nl}      setPendingKycFiles([]);${nl}      // Set edit mode to true so form is visible`,
  );
  console.log('OK client-kyc-resets');
}

fs.writeFileSync(path.join(root, 'src/components/drawers/ClientDetailsDrawer.tsx'), client);
console.log('done');
