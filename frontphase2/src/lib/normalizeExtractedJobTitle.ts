/**
 * Keep Add Job extracted titles short and accurate (mirrors backend normalizeExtractedJobTitle).
 */
export function normalizeExtractedJobTitle(
  raw: string,
  { maxLength = 56, maxWords = 8 }: { maxLength?: number; maxWords?: number } = {},
): string {
  let title = String(raw || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return '';

  title = title
    .replace(
      /^(?:job\s*title|role|position|designation|opening\s+for|vacancy\s+for)\s*[:\-–—]\s*/i,
      '',
    )
    .trim();

  const lookingMatch = title.match(
    /^(?:we\s+are\s+)?(?:currently\s+)?(?:looking\s+for|seeking|hiring|recruiting)\s+(?:an?\s+|the\s+)?(.+)$/i,
  );
  if (lookingMatch?.[1]) {
    title = lookingMatch[1].trim();
  }

  title = title
    .replace(/\s*[|•·]\s*.*$/u, '')
    .replace(
      /\s+[-–—]\s*(?:we\s+are|looking|seeking|hiring|join|based|remote|hybrid|onsite|on-site|immediate).*$/i,
      '',
    )
    .replace(/\s+(?:with|having)\s+\d+\+?\s*(?:-\s*\d+\+?\s*)?(?:years?|yrs?).*$/i, '')
    .replace(/\s+(?:with)\s+(?:\d+\+?\s*)?(?:years?|yrs?)\s+of\b.*$/i, '')
    .replace(/\s+(?:based\s+in|located\s+in|work\s+from|working\s+from)\b.*$/i, '')
    .replace(/\s+(?:for\s+our|to\s+join|who\s+(?:can|will|have)|responsible\s+for)\b.*$/i, '')
    .replace(/\s+(?:salary|ctc|lpa|compensation|package|₹|\$|usd|inr)\b.*$/i, '')
    .replace(/\s+(?:full[-\s]?time|part[-\s]?time|contract|internship)\s*$/i, '')
    .trim();

  let prev = '';
  while (title !== prev) {
    prev = title;
    title = title.replace(/\s*[([（][^)\]]{2,160}[)\]][）]?\s*$/g, '').trim();
  }

  title = title
    .replace(
      /\s*[–—|-]\s*(?:remote|hybrid|on[-\s]?site|onsite|wfh|full[-\s]?time|part[-\s]?time|contract|internship)\s*$/i,
      '',
    )
    .replace(/\s+(?:full[-\s]?time|part[-\s]?time|contract|internship)\s*$/i, '')
    .trim();

  title = title
    .replace(
      /\s*[–—|-]\s*((?:Mumbai|Delhi|Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Kolkata|Gurgaon|Gurugram|Noida|India|USA|UK|UAE|Remote)(?:\s*,\s*[A-Za-z]+)*)\s*$/i,
      '',
    )
    .trim();

  const dashParts = title.split(/\s*[–—]\s*/).map((part) => part.trim()).filter(Boolean);
  if (dashParts.length > 2) {
    title = `${dashParts[0]} – ${dashParts[1]}`;
  }
  if (
    /^(?:Mumbai|Delhi|Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Kolkata|Gurgaon|Gurugram|Noida|India|USA|UK|UAE|Remote)$/i.test(
      dashParts[1] || '',
    )
  ) {
    title = dashParts[0];
  }

  let words = title.split(/\s+/).filter(Boolean);
  if (words.length > maxWords || /\b(looking|seeking|hiring|responsible|experience)\b/i.test(title)) {
    words = words.filter(
      (w) => !/^(?:an?|the|for|our|your|with|and|or|to|of|in|at|on)$/i.test(w),
    );
  }
  if (words.length > maxWords) {
    title = words.slice(0, maxWords).join(' ');
  } else {
    title = words.join(' ');
  }

  if (title.length > maxLength) {
    const parts = title.split(/\s*[–—]\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const rolePlusDomain = `${parts[0]} – ${parts[1]}`;
      if (rolePlusDomain.length <= maxLength) {
        title = rolePlusDomain;
      } else if (parts[0].length <= maxLength) {
        title = parts[0];
      } else {
        title = parts[0].slice(0, maxLength).replace(/\s+\S*$/, '').trim();
      }
    } else {
      title = title.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
    }
  }

  return title.replace(/\s*[–—|,;:.\-]+\s*$/g, '').trim();
}
