import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center px-5 text-center">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-gold/70 uppercase mb-6">
        UniPath Admin
      </p>
      <div className="font-heading text-[8rem] sm:text-[10rem] font-bold leading-none text-white/8 select-none">
        404
      </div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white mt-2 mb-4">
        Page not found
      </h1>
      <p className="text-white/35 text-sm max-w-xs mb-10 leading-relaxed">
        This page doesn&rsquo;t exist or you don&rsquo;t have permission to access it.
      </p>
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-dark transition-colors"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
