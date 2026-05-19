import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

function apply(relPath, replacements) {
  const p = path.join(root, '..', relPath);
  let s = fs.readFileSync(p, 'utf8');
  for (const [from, to, label] of replacements) {
    if (!s.includes(from)) {
      console.warn('SKIP (not found):', label);
      continue;
    }
    s = s.replace(from, to);
    console.log('OK:', label);
  }
  fs.writeFileSync(p, s);
}

const kycAddLead = `
                        <div>
                          <KycDocumentsField
                            pendingFiles={pendingAddLeadKycFiles}
                            onPendingFilesChange={setPendingAddLeadKycFiles}
                            uploading={uploadingKyc}
                            disabled={uploadingAgreements}
                          />
                        </div>`;

const kycLeadEdit = `
                            <motion.div className="md:col-span-2">
                              <KycDocumentsField
                                pendingFiles={pendingOverviewKycFiles}
                                onPendingFilesChange={setPendingOverviewKycFiles}
                                storedFiles={leadKycFiles}
                                onRemoveStored={async (fileId) => {
                                  await deleteLeadFile(fileId);
                                  await refetchLeadFiles();
                                }}
                                uploading={uploadingKyc}
                                disabled={uploadingAgreements}
                              />
                            </motion.div>`.replace(/motion\.div/g, 'div');

const kycLeadView = `
                          <KycDocumentsView files={leadKycFiles} />
`;

apply('src/components/drawers/LeadDetailsDrawer.tsx', [
  [
    `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                  </motion.div>

                  {/* Submit Button */}`.replace(/motion\.div/g, 'div'),
    `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </div>
                        </div>${kycAddLead}
                      </div>
                    )}
                  </section>
                  </div>

                  {/* Submit Button */}`,
    'lead-add-kyc',
  ],
  [
    `                          {lead?.agreementsFileUrl && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agreements &amp; Terms</motion.div>`,
    `                          {lead?.agreementsFileUrl && (
                            <div>
                              <motion.div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agreements &amp; Terms</motion.div>`,
    'lead-view-agreements-broken',
  ],
]);
