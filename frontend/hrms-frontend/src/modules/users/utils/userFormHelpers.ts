/** Suggest display name + employee code from an email address (all editable in the form). */
export function suggestFromEmail(email: string) {
  const trimmed = email.trim()
  if (!trimmed.includes('@')) {
    return { displayName: '', employeeCode: '' }
  }
  const local = trimmed.split('@')[0] || ''
  const displayName = local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
  const slug = local.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12)
  const employeeCode = slug ? `EMP-${slug}` : ''
  return { displayName, employeeCode }
}
