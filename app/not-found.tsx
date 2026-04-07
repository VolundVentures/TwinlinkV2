import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f8]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#1a1c1c]">404</h1>
        <p className="mt-3 text-[15px] text-[#737373]">Page not found</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-[#1a1c1c] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
