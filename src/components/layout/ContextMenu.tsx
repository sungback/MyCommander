import { useEffect, type FC } from "react";
import { listen } from "@tauri-apps/api/event";
import { useFileSystem } from "../../hooks/useFileSystem";
import { handleNativeContextMenuAction } from "./contextMenuActions";

export const ContextMenu: FC = () => {
  const fs = useFileSystem();

  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | undefined;

    void listen<string>("context-menu-action", async (event) => {
      if (!isMounted) {
        return;
      }

      await handleNativeContextMenuAction(event.payload, fs);
    }).then((unlisten) => {
      if (isMounted) {
        cleanup = unlisten;
      } else {
        unlisten();
      }
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [fs]);

  return null;
};
