const BELOW_TWENTY = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numberToWordsUnder1000(n: number): string {
  if (n < 20) return BELOW_TWENTY[n];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    return ones ? `${tens} ${BELOW_TWENTY[ones]}` : tens;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredPart = `${BELOW_TWENTY[hundreds]} Hundred`;
  return rest ? `${hundredPart} ${numberToWordsUnder1000(rest)}` : hundredPart;
}

function numberToWordsInt(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${numberToWordsUnder1000(crore)} Crore`);
  if (lakh) parts.push(`${numberToWordsUnder1000(lakh)} Lakh`);
  if (thousand) parts.push(`${numberToWordsUnder1000(thousand)} Thousand`);
  if (n) parts.push(numberToWordsUnder1000(n));

  return parts.join(' ');
}

/** Amount in words for invoice footer (Indian-style grouping optional). */
export function amountToWords(amount: number, currency = 'USD'): string {
  const safe = Math.max(Number(amount) || 0, 0);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  let words = numberToWordsInt(rupees);
  const unit = currency === 'INR' ? 'Rupees' : currency === 'EUR' ? 'Euros' : 'Dollars';
  words += ` ${unit}`;
  if (paise > 0) {
    words += ` and ${numberToWordsInt(paise)} Cents`;
  }
  return `${words} only`;
}
