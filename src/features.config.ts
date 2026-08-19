export const FEATURE_FLAGS = {
  PRIMITIVE_MODE: false, 
  ENABLE_FLASHCARDS: true,
  ENABLE_STUDY_ROOM: true,
  ENABLE_CO_STUDY: false,
  ENABLE_TEACHER_DASHBOARD: true,
  ENABLE_ADMIN_CREATE: true,
  ENABLE_ACHIEVEMENTS: true,
  ENABLE_RANKING: true,
  ENABLE_VIBE_BACKUP_RESTORE_X: true,
  "legacy-study-room": false,
  "vibe-flashcard-learning": true,
  "vibe-study-nav": true,
  "vibe-student-dashboard": true,
  "vibe-deck-stats-banner": true,
  "vibe-smart-filters": true,
  "vibe-heatmap": true,
  "vibe-fanout-deck": true,
};
export const isFeatureEnabled = (featureKey: keyof typeof FEATURE_FLAGS | string) => {
  if (FEATURE_FLAGS.PRIMITIVE_MODE) {
    if (featureKey === 'ENABLE_FLASHCARDS') return true;
    return false;
  }
  return (FEATURE_FLAGS as any)[featureKey] || false;
};
