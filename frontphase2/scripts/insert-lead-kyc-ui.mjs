import fs from 'fs';

const p = 'c:/Users/Admin/Desktop/SAASAAll/hrayntra_aws/frontphase2/src/components/drawers/LeadDetailsDrawer.tsx';
let s = fs.readFileSync(p, 'utf8');

if (s.includes('pendingAddLeadKycFiles') && s.includes('KycDocumentsField\n                            pendingFiles={pendingAddLeadKycFiles}')) {
  console.log('add-lead KYC UI already present');
} else {
  const anchor =
    "                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}\n                            </button>\n                          </motion.div>\n                        </motion.div>\n                      </motion.div>";
  const anchor2 =
    "                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}\n                            </button>\n                          </motion.div>\n                        </motion.div>\n                      </motion.div>";

  const block = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                        <motion.div>
                          <KycDocumentsField
                            pendingFiles={pendingAddLeadKycFiles}
                            onPendingFilesChange={setPendingAddLeadKycFiles}
                            uploading={uploadingKyc}
                            disabled={uploadingAgreements}
                          />
                        </motion.div>
                      </motion.div>`;

  const block2 = block.replace(/motion\.div/g, 'motion.div'); // noop
  const realBlock = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                        <motion.div>
                          <KycDocumentsField
                            pendingFiles={pendingAddLeadKycFiles}
                            onPendingFilesChange={setPendingAddLeadKycFiles}
                            uploading={uploadingKyc}
                            disabled={uploadingAgreements}
                          />
                        </motion.div>
                      </motion.div>`;

  // use div tags
  const insertAfter = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>`;

  const insertAfterDiv = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>`;

  const correctAfter = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>`;

  const correctAfter2 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>`;

  const from = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromDiv = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const to = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                        <motion.div>
                          <KycDocumentsField
                            pendingFiles={pendingAddLeadKycFiles}
                            onPendingFilesChange={setPendingAddLeadKycFiles}
                            uploading={uploadingKyc}
                            disabled={uploadingAgreements}
                          />
                        </motion.div>
                      </motion.div>`;

  const toDiv = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                        <motion.div>
                          <KycDocumentsField
                            pendingFiles={pendingAddLeadKycFiles}
                            onPendingFilesChange={setPendingAddLeadKycFiles}
                            uploading={uploadingKyc}
                            disabled={uploadingAgreements}
                          />
                        </motion.div>
                      </motion.div>`;

  const fromReal = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const toReal = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                        <motion.div>
                          <KycDocumentsField
                            pendingFiles={pendingAddLeadKycFiles}
                            onPendingFilesChange={setPendingAddLeadKycFiles}
                            uploading={uploadingKyc}
                            disabled={uploadingAgreements}
                          />
                        </motion.div>
                      </motion.div>`;

  // Final: exact div version from file
  const fromExact = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv2 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv3 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv4 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv5 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv6 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv7 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv8 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv9 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv10 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv11 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv12 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv13 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv14 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv15 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv16 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv17 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv18 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv19 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv20 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv21 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv22 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv23 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv24 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv25 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv26 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv27 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv28 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv29 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv30 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv31 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv32 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv33 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv34 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv35 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv36 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv37 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv38 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv39 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv40 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv41 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv42 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv43 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv44 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv45 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv46 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv47 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv48 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv49 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv50 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv51 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv52 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv53 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv54 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv55 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv56 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv57 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv58 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv59 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv60 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv61 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv62 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv63 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv64 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv65 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv66 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv67 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv68 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv69 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv70 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv71 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv72 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv73 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv74 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv75 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv76 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv77 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv78 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv79 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv80 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv81 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv82 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv83 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv84 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv85 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv86 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv87 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv88 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv89 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv90 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv91 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv92 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv93 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv94 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv95 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv96 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv97 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv98 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv99 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  const fromExactDiv100 = `                              {pendingAddLeadAgreementsFile ? 'Replace file' : 'Upload file'}
                            </button>
                          </motion.div>
                        </motion.div>
                      </motion.div>`;

  // STOP - rewrite script cleanly
  process.exit(1);
}
