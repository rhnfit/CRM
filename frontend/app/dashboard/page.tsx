import { Suspense } from 'react';
import DashboardContent from './dashboard-content';
import { SkeletonKpiGrid } from '../../components/ui/skeleton';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={(
        <div className="p-6">
          <SkeletonKpiGrid />
        </div>
      )}
    >
      <DashboardContent />
    </Suspense>
  );
}
