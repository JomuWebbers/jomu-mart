import { createContext } from "react";

export type SavedItemsContextType = {
  savedCount: number | null;
  markSavedItem: (productId: string, saved: boolean) => void;
};

export const SavedItemsContext = createContext<
  SavedItemsContextType | undefined
>(undefined);
