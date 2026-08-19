import React, { useState, useEffect } from "react";
import { X, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { auth } from "../lib/firebase";

export const VibeClassModal = ({ isOpen, onClose, deckIds }: { isOpen: boolean, onClose: () => void, deckIds: string[] }) => {
  const [classes, setClasses] = useState<any[]>([]);
  const currentUserId = auth.currentUser?.uid || "guest";

  useEffect(() => {
    if (isOpen) {
      const loaded = localStorage.getItem("vibe_classes");
      if (loaded) {
        setClasses(JSON.parse(loaded));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const adminClasses = classes.filter(c => 
    c.createdBy === currentUserId || 
    c.members.some((m: any) => m.id === currentUserId && m.role === 'admin')
  );

  const handleAdd = (clsId: string) => {
    const updated = classes.map(c => {
      if (c.id === clsId) {
        const validDeckIds = deckIds.filter(id => id && id.trim() !== "");
        const newDecks = validDeckIds.filter(id => !c.deckIds.includes(id));
        if (newDecks.length === 0) {
          toast.info("Học phần đã có trong lớp này rồi!");
          return c;
        }
        toast.success(`Đã thêm ${newDecks.length} học phần vào lớp ${c.name}!`);
        return { ...c, deckIds: [...c.deckIds, ...newDecks] };
      }
      return c;
    });
    localStorage.setItem("vibe_classes", JSON.stringify(updated));
    setClasses(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" /> Thêm vào Lớp Học
          </h3>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {adminClasses.length === 0 ? (
            <div className="text-center py-6 text-zinc-500">
              <p>Bạn chưa tạo lớp học nào.</p>
              <p className="text-sm mt-1">Hãy tạo lớp học mới trong tab Lớp Học.</p>
            </div>
          ) : (
            adminClasses.map(cls => (
              <div key={cls.id} className="flex justify-between items-center p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                <div>
                  <h4 className="font-bold">{cls.name}</h4>
                  <p className="text-xs text-zinc-500">{cls.deckIds.length} học phần</p>
                </div>
                <button 
                  onClick={() => handleAdd(cls.id)}
                  className="p-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 rounded-lg transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
