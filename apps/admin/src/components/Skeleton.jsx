import React from 'react';

export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

// Squelette du tableau de bord : même grille que la vraie page, donc aucun saut de mise en page.
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-8 w-56 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 rounded-2xl mt-6" />
    </div>
  );
}
