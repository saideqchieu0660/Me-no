import { useState, useEffect } from "react";
import { VibeSyncEngine } from "./VibeSyncEngine";
import { Deck } from "../../lib/store";

export function useLiveVibeDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await VibeSyncEngine.getLocalDecks();
      if (mounted) setDecks(data);
    };

    load();
    VibeSyncEngine.syncNow(); 
    VibeSyncEngine.startRealtimeSync();

    const unsubscribe = VibeSyncEngine.subscribe(() => {
      load();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return decks;
}
