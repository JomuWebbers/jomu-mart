import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useAuth } from "./useAuth";
import { apiRequest } from "../lib/api";
import { SavedItemsContext } from "./saved-items-context";

type SavedItem = { id: string };

export function SavedItemsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [savedItems, setSavedItems] = useState<{
    token: string;
    ids: string[];
  } | null>(null);
  const requestVersion = useRef(0);

  const fetchSavedItems = useCallback(
    (authToken: string) =>
      apiRequest("/wishlist", { token: authToken }) as Promise<SavedItem[]>,
    [],
  );

  useEffect(() => {
    if (!token) return;

    const version = ++requestVersion.current;
    fetchSavedItems(token)
      .then((items) => {
        if (requestVersion.current === version) {
          setSavedItems({ token, ids: items.map((item) => item.id) });
        }
      })
      .catch((error: unknown) => {
        if (requestVersion.current === version) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load your saved-item count.",
          );
        }
      });
    return () => {
      requestVersion.current += 1;
    };
  }, [token, fetchSavedItems]);

  const markSavedItem = useCallback(
    (productId: string, saved: boolean) => {
      if (!token) return;
      if (savedItems?.token !== token) {
        const version = ++requestVersion.current;
        fetchSavedItems(token)
          .then((items) => {
            if (requestVersion.current === version) {
              setSavedItems({ token, ids: items.map((item) => item.id) });
            }
          })
          .catch((error: unknown) => {
            if (requestVersion.current === version) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not load your saved-item count.",
              );
            }
          });
        return;
      }

      setSavedItems((current) => {
        if (current?.token !== token) return current;
        if (saved) {
          return current.ids.includes(productId)
            ? current
            : { ...current, ids: [...current.ids, productId] };
        }
        return {
          ...current,
          ids: current.ids.filter((id) => id !== productId),
        };
      });
    },
    [fetchSavedItems, savedItems, token],
  );

  return (
    <SavedItemsContext.Provider
      value={{
        savedCount:
          token && savedItems?.token === token ? savedItems.ids.length : null,
        markSavedItem,
      }}
    >
      {children}
    </SavedItemsContext.Provider>
  );
}
