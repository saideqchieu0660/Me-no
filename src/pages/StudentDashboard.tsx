import React, { lazy, Suspense } from "react";
import { isFeatureEnabled } from "../features.config";

const LegacyStudentDashboard = lazy(() => import("./LegacyStudentDashboard"));
const VibeStudentDashboard = lazy(() => import("../vibe-sandbox/VibeStudentDashboard"));

export default function StudentDashboard() {
  if (isFeatureEnabled("vibe-student-dashboard")) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>}>
        <VibeStudentDashboard />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>}>
      <LegacyStudentDashboard />
    </Suspense>
  );
}
