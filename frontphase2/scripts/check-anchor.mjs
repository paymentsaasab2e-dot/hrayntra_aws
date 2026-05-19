import fs from 'fs';
const p = 'src/components/drawers/ClientDetailsDrawer.tsx';
const s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
console.log('nl', JSON.stringify(nl));
const anchor = `{pendingAgreementsFile ? 'Replace file' : 'Upload file'}${nl}                            </button>${nl}                          </motion.div>${nl}                        </motion.div>${nl}                      </motion.div>${nl}                    </section>`.replace(
  /motion\.div/g,
  'div',
);
console.log('found', s.indexOf(anchor) >= 0);
const i = s.indexOf("{pendingAgreementsFile ? 'Replace file'");
console.log(JSON.stringify(s.slice(i, i + 180)));
