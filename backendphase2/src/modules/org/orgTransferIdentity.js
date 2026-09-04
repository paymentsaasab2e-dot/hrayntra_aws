export function normTransferKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Stable identity so a copied job/client/lead/candidate is not offered or cloned again. */
export function transferIdentityKey(type, row) {
  if (!row) return '';
  if (type === 'jobs') {
    const title = normTransferKey(row.title);
    if (!title) return '';
    return [
      'job',
      title,
      String(row.clientId || ''),
      normTransferKey(row.location || row.city),
      normTransferKey(row.department),
    ].join('|');
  }
  if (type === 'clients' || type === 'recruitmentClients') {
    const name = normTransferKey(row.companyName);
    if (!name) return '';
    return ['client', name, normTransferKey(row.website)].join('|');
  }
  if (type === 'leads') {
    const email = normTransferKey(row.email);
    const company = normTransferKey(row.companyName);
    const contact = normTransferKey(row.contactName || row.contactPerson || row.directorName);
    if (email) return ['lead', email].join('|');
    if (company || contact) return ['lead', company, contact, normTransferKey(row.phone)].join('|');
    return '';
  }
  if (type === 'candidates') {
    const email = normTransferKey(row.email);
    if (email) return ['candidate', email].join('|');
    const name = [normTransferKey(row.firstName), normTransferKey(row.lastName)].filter(Boolean).join(' ');
    const phone = normTransferKey(row.phone);
    if (!name && !phone) return '';
    return ['candidate', name, phone].join('|');
  }
  return '';
}
