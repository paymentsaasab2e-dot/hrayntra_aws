interface ResumeSummaryProps {
  summary: string;
}

export default function ResumeSummary({ summary }: ResumeSummaryProps) {
  if (!summary) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Summary</h2>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
    </section>
  );
}
