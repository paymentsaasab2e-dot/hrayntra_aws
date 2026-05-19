import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content);
}

function nlOf(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function insertAfter(content, anchor, insert, label) {
  if (content.includes(insert.trim().slice(0, 50))) {
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

// --- Lead ---
let lead = read('src/components/drawers/LeadDetailsDrawer.tsx');
const nl = nlOf(lead);

const misplaced = `${nl}                      </div>${nl}                        <motion.div className="mt-4">`.replace(/motion\.div/g, 'motion.div');
const misplaced2 = `${nl}                      </div>${nl}                        <div className="mt-4">`;
const fixed = `${nl}                        <div className="mt-4">`;

for (const bad of [misplaced2, misplaced]) {
  if (lead.includes(bad)) {
    lead = lead.replace(
      bad +
        `${nl}                          <KycDocumentsField${nl}                            pendingFiles={pendingAddLeadKycFiles}${nl}                            onPendingFilesChange={setPendingAddLeadKycFiles}${nl}                            uploading={uploadingKyc}${nl}                            disabled={uploadingAgreements}${nl}                          />${nl}                        </div>${nl}                    )}`,
      fixed +
        `${nl}                          <KycDocumentsField${nl}                            pendingFiles={pendingAddLeadKycFiles}${nl}                            onPendingFilesChange={setPendingAddLeadKycFiles}${nl}                            uploading={uploadingKyc}${nl}                            disabled={uploadingAgreements}${nl}                          />${nl}                        </div>${nl}                      </div>${nl}                    )}`,
    );
    console.log('OK lead-fix-add-placement');
    break;
  }
}

lead = insertAfter(
  lead,
  `{overviewEditForm.agreementsFileUrl || pendingOverviewAgreementsFile ? 'Replace file' : 'Upload file'}${nl}                                </button>${nl}                              </div>${nl}                            </div>${nl}                          </div>`,
  `${nl}                            <div className="md:col-span-2">${nl}                              <KycDocumentsField${nl}                                pendingFiles={pendingOverviewKycFiles}${nl}                                onPendingFilesChange={setPendingOverviewKycFiles}${nl}                                storedFiles={leadKycFiles}${nl}                                onRemoveStored={async (fileId) => {${nl}                                  await deleteLeadFile(fileId);${nl}                                  await refetchLeadFiles();${nl}                                }}${nl}                                uploading={uploadingKyc}${nl}                                disabled={uploadingAgreements}${nl}                              />${nl}                            </div>`,
  'lead-edit-kyc',
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

write('src/components/drawers/LeadDetailsDrawer.tsx', lead);

// --- Client ---
let client = read('src/components/drawers/ClientDetailsDrawer.tsx');
const cnl = nlOf(client);

client = insertAfter(
  client,
  `{pendingAgreementsFile ? 'Replace file' : 'Upload file'}${cnl}                            </button>${cnl}                          </div>${cnl}                        </div>${cnl}                      </div>${cnl}                    </section>`,
  `${cnl}                        <div className="mt-4">${cnl}                          <KycDocumentsField${cnl}                            pendingFiles={pendingKycFiles}${cnl}                            onPendingFilesChange={setPendingKycFiles}${cnl}                            uploading={uploadingKyc}${cnl}                            disabled={uploadingAgreements}${cnl}                          />${cnl}                        </div>`,
  'client-add-kyc',
);

client = insertAfter(
  client,
  `{overviewEditForm.agreementsFileUrl || pendingAgreementsFile ? 'Replace file' : 'Upload file'}${cnl}                                </button>${cnl}                              </motion.div>${cnl}                            </motion.div>${cnl}                          </>`.replace(
    /motion\.div/g,
    'div',
  ),
  `${cnl}                            <div>${cnl}                              <KycDocumentsField${cnl}                                pendingFiles={pendingKycFiles}${cnl}                                onPendingFilesChange={setPendingKycFiles}${cnl}                                storedFiles={clientKycFiles}${cnl}                                uploadsBase={uploadsBase}${cnl}                                onRemoveStored={async (fileId) => {${cnl}                                  await deleteFile(fileId);${cnl}                                  await refetchClientFiles();${cnl}                                }}${cnl}                                uploading={uploadingKyc}${cnl}                                disabled={uploadingAgreements}${cnl}                              />${cnl}                            </div>`,
  'client-edit-kyc-wrong',
);

client = insertAfter(
  client,
  `{overviewEditForm.agreementsFileUrl || pendingAgreementsFile ? 'Replace file' : 'Upload file'}${cnl}                                </button>${cnl}                              </div>${cnl}                            </div>${cnl}                          </>`,
  `${cnl}                            <div>${cnl}                              <KycDocumentsField${cnl}                                pendingFiles={pendingKycFiles}${cnl}                                onPendingFilesChange={setPendingKycFiles}${cnl}                                storedFiles={clientKycFiles}${cnl}                                uploadsBase={uploadsBase}${cnl}                                onRemoveStored={async (fileId) => {${cnl}                                  await deleteFile(fileId);${cnl}                                  await refetchClientFiles();${cnl}                                }}${cnl}                                uploading={uploadingKyc}${cnl}                                disabled={uploadingAgreements}${cnl}                              />${cnl}                            </motion.div>`.replace(
    /<\/motion\.div>$/,
    '</div>',
  ),
  'client-edit-kyc',
);

client = client.replace(
  `<KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />                          </>`,
  `<KycDocumentsView files={clientKycFiles} uploadsBase={uploadsBase} />${cnl}                          </>`,
);

if (!client.includes('setPendingKycFiles([]);')) {
  client = client.replace(
    `setPendingAgreementsFile(null);${cnl}    setOverviewEditMode(true);`,
    `setPendingAgreementsFile(null);${cnl}    setPendingKycFiles([]);${cnl}    setOverviewEditMode(true);`,
  );
  client = client.replace(
    `const cancelOverviewEdit = () => {${cnl}    setOverviewEditMode(false);${cnl}    resetClientLogoDraft();${cnl}    setPendingAgreementsFile(null);`,
    `const cancelOverviewEdit = () => {${cnl}    setOverviewEditMode(false);${cnl}    resetClientLogoDraft();${cnl}    setPendingAgreementsFile(null);${cnl}    setPendingKycFiles([]);`,
  );
  client = client.replace(
    `setPendingAgreementsFile(null);${cnl}      // Set edit mode to true so form is visible`,
    `setPendingAgreementsFile(null);${cnl}      setPendingKycFiles([]);${cnl}      // Set edit mode to true so form is visible`,
  );
  console.log('OK client-kyc-resets');
}

write('src/components/drawers/ClientDetailsDrawer.tsx', client);
console.log('done');
