import { useState, useEffect } from "react";
import { VibeSyncEngine } from "./VibeSyncEngine";
import { Deck } from "../../lib/store";

export function useLiveVibeDeck(deckId: string | undefined) {
  const [deck, setDeck] = useState<Deck | null>(null);

  useEffect(() => {
    if (!deckId) return;
    let mounted = true;
    const load = async () => {
      const data = await VibeSyncEngine.getDeck(deckId);
      if (mounted) setDeck(data);
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
  }, [deckId]);

  return deck;
}
