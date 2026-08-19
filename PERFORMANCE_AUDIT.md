# Performance Audit Report

## Phase 1: Bottlenecks Identified

### 1. Unnecessary Re-renders and Heavy State in Root (`App.tsx`)
- **Global State Coupling**: `App.tsx` manages `user`, `currentUserRank`, `isAdminMode`, `pulse`, etc. Any change to these states re-renders the entire `<Layout>` and its children, including `<Routes>` and heavy dashboard components.
- **Contrast Checker**: `runContrastCheck` scans the DOM for hundreds of elements and calculates color luminance. It is scheduled to run every 1.5 seconds while `showSettingsModal` is open.
- **Event Listeners**: There are many `window.addEventListener` calls (keyboard, custom events) that trigger state updates, causing top-level re-renders.

### 2. Heavy Computations on Render (`VibeStudentDashboard.tsx`)
- **`localDecks` Derivation**: `localDecks` is derived by iterating over all `rawDecks` and all their `cards`, then matching with `personalCardStates`. This `useMemo` is heavy for users with thousands of cards.
- **`sortedUsers` Calculation**: Leaderboard calculation maps, filters, and sorts the entire `dbUsers` list (or `store.getUsers()`) every time `dbUsers` updates. It also creates a `requestIdleCallback` loop to animate rank trends, which triggers React state updates for `rankTrends`.
- **`calculateWeeklyStudyHours`**: Iterates through the entire `store.getReviewHistory` to calculate time spent, running frequently.

### 3. Real-time Firebase Listeners
- **Duplicate/Overlapping Listeners**: `App.tsx` listens to the user profile and users collection (for rank). `VibeStudentDashboard.tsx` also listens to the `users` collection for the leaderboard, `decks`, and `cardsState`. Every snapshot triggers a state update, forcing full re-renders of the dashboard.

### 4. DOM & Bundle Size
- **Component Monolith**: `VibeStudentDashboard.tsx` is >4500 lines long, containing modals, tabs, inline charts, and complex UI components. Lazy loading is not applied to sub-tabs (like `AdminCreateCards`, `DetailedStatsModal`, `EditDeckModal`).
- **Heavy Libraries**: `recharts`, `react-markdown`, `html2canvas`, `d3`, etc. are bundled together.

### 5. Animation Thrashing
- **`requestIdleCallback` Rank Animation**: Triggers `setRankTrends` which causes a React render tree update on every leaderboard change.

## Optimization Plan

1. **State Co-location & Memoization**:
   - Wrap heavy list components (`DeckList`, Leaderboard Items, Modals) in `React.memo` with custom `arePropsEqual` if necessary, to prevent re-rendering when unrelated dashboard state (like active tab) changes.
   - Memoize the `localDecks` and `sortedUsers` maps efficiently. Use stable references for dependencies.

2. **Network & Listener Efficiency**:
   - Ensure Firestore snapshots (`onSnapshot`) are cleaned up. 
   - Debounce rapid state updates from Firebase listeners if they cause UI stuttering.

3. **Lazy Loading**:
   - Lazy load heavy modals and inactive tabs (`DetailedStatsModal`, `DocumentConverter`, `ManualFlashcardImporter`) inside `VibeStudentDashboard` and `App.tsx`.

4. **Rendering Enhancements**:
   - Ensure context providers don't pass unstable objects.
   - Separate the DOM contrast check interval to use a ref to prevent re-triggering hooks.

(No business logic, DB schema, or features will be altered.)
