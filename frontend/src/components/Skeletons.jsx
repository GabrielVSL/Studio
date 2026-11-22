import React from 'react';

export function HeroSkeleton() {
  return (
    <section className="relative w-full h-[92vh] min-h-[620px] bg-[#09090B] flex flex-col justify-between overflow-hidden pt-28 pb-10">
      <div className="absolute inset-0 skeleton-shimmer opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />

      <div className="relative z-10 container mx-auto px-5 sm:px-8 lg:px-14 my-auto space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded skeleton-shimmer" />
          <div className="h-6 w-20 rounded skeleton-shimmer" />
        </div>
        <div className="h-14 w-80 max-w-full rounded-xl skeleton-shimmer" />
        <div className="flex gap-3 items-center">
          <div className="h-6 w-14 rounded skeleton-shimmer" />
          <div className="h-6 w-10 rounded skeleton-shimmer" />
          <div className="h-7 w-7 rounded-lg skeleton-shimmer" />
        </div>
        <div className="flex gap-3 items-center pt-2">
          <div className="h-11 w-11 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-24 rounded skeleton-shimmer" />
        </div>
      </div>

      {/* Rodapé 4-cantos skeleton */}
      <div className="relative z-10 container mx-auto px-5 sm:px-8 lg:px-14 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-16 rounded-lg skeleton-shimmer" />
          <div className="space-y-2">
            <div className="h-3 w-20 rounded skeleton-shimmer" />
            <div className="h-3 w-28 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="hidden sm:block w-60 aspect-[16/10] rounded-2xl skeleton-shimmer" />
      </div>
    </section>
  );
}

export function CardGridSkeleton({
  count = 10,
  cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
}) {
  return (
    <div className={`grid ${cols} gap-4 md:gap-5`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]"
        >
          <div className="aspect-[2/3] w-full skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function DetailsSkeleton() {
  return (
    <main className="min-h-screen bg-[#09090B] pb-20">
      <div className="w-full h-[60vh] skeleton-shimmer opacity-40" />
      <div className="container mx-auto px-5 sm:px-8 lg:px-14 mt-8 flex flex-col md:flex-row gap-8">
        <div className="w-44 aspect-[2/3] rounded-2xl skeleton-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded skeleton-shimmer" />
            <div className="h-6 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="h-12 w-2/3 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-full max-w-xl rounded skeleton-shimmer" />
          <div className="h-4 w-4/5 max-w-lg rounded skeleton-shimmer" />
        </div>
        <div className="w-full md:w-64 aspect-[16/10] rounded-2xl skeleton-shimmer flex-shrink-0" />
      </div>
    </main>
  );
}

export function EpisodeSkeleton({ count = 5 }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="w-52 aspect-video rounded-xl skeleton-shimmer flex-shrink-0"
        />
      ))}
    </div>
  );
}
