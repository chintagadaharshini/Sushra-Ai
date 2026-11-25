import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div>
        <p className="text-sm font-bold text-brand-700">404</p>
        <h1 className="mt-1 text-2xl font-extrabold">We couldn&apos;t find that page or record</h1>
        <p className="mt-2 text-muted">It may not exist, or it may belong to another patient.</p>
        <Link href="/dashboard" className="mt-5 inline-flex h-11 items-center rounded-xl bg-ink px-4 font-semibold text-white">Back to dashboard</Link>
      </div>
    </div>
  );
}
