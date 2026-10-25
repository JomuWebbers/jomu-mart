import { useContext } from "react";
import { SavedItemsContext } from "./saved-items-context";

export function useSavedItems() {
  const context = useContext(SavedItemsContext);
  if (!context) {
    throw new Error("useSavedItems must be used within SavedItemsProvider");
  }
  return context;
}
