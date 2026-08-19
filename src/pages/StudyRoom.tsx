import React, { lazy, Suspense } from "react";
import { isFeatureEnabled } from "../features.config";

const LegacyStudyRoom = lazy(() => import("./LegacyStudyRoom"));
const VibeStudyRoom = lazy(() => import("../vibe-sandbox/VibeStudyRoom"));

export default function StudyRoom() {
  if (isFeatureEnabled("vibe-flashcard-learning")) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Study Room...</div>}>
        <VibeStudyRoom />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Study Room...</div>}>
      <LegacyStudyRoom />
    </Suspense>
  );
}
