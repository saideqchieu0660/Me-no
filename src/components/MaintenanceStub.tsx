import React from "react";
import { isFeatureEnabled } from "../features.config";

export const MaintenanceStub = ({ featureName }: { featureName?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-500">
      <div className="text-4xl">🚧</div>
      <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
        {featureName ? `${featureName} is Under Maintenance` : "Feature Coming Soon"}
      </h2>
      <p className="text-sm max-w-md text-center">
        We are currently running in Primitive Mode. This feature has been disabled
        temporarily for maintenance and isolation.
      </p>
    </div>
  );
};

export const FeatureFlagWrapper = ({
  featureKey,
  children,
  fallback = null,
}: {
  featureKey: Parameters<typeof isFeatureEnabled>[0];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  if (!isFeatureEnabled(featureKey)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
