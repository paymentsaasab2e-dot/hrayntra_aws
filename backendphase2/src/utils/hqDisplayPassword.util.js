/**
 * Persist the last known plain password for HQ tenant Users tab visibility.
 * Auth always uses hashedPassword — this field is support-only.
 */
export async function setHqDisplayPassword(prismaClient, userId, plainPassword) {
  const password = String(plainPassword || '').trim();
  const id = String(userId || '').trim();
  if (!password || !id || !prismaClient?.userCredential?.update) return;
  try {
    await prismaClient.userCredential.update({
      where: { userId: id },
      data: { hqDisplayPassword: password },
    });
  } catch (err) {
    // Older Prisma clients / docs without the field should not break login.
    if (!/Unknown arg|Unknown argument|hqDisplayPassword/i.test(String(err?.message || ''))) {
      console.warn('[hqDisplayPassword] update failed:', err?.message || err);
    }
  }
}
