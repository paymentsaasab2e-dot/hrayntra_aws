import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        This page isn’t available. It may have been moved or the link is no longer valid.
      </p>
      <Link href="/dashboard" className="mt-6 text-sm font-semibold text-sky-700 hover:underline">
        Go to dashboard
      </Link>
    </div>
  );
}
