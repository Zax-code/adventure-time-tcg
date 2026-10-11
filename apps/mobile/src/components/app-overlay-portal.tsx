import type { ReactNode } from "react";
import {
  createContext,
  use,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { StyleSheet, View } from "react-native";
import { useIsFocused } from "expo-router";

type OverlaySnapshot = Array<[string, ReactNode]>;

type AppOverlayContextValue = {
  addOverlay: (key: string, element: ReactNode) => void;
  removeOverlay: (key: string) => void;
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => OverlaySnapshot;
};

const AppOverlayContext = createContext<AppOverlayContextValue | null>(null);
const EMPTY_OVERLAY_SNAPSHOT: OverlaySnapshot = [];

export function AppOverlayProvider({ children }: { children: ReactNode }) {
  const [context] = useState<AppOverlayContextValue>(() => {
    const overlays = new Map<string, ReactNode>();
    const subscribers = new Set<() => void>();
    let snapshot: OverlaySnapshot = [];

    const notify = () => {
      snapshot = Array.from(overlays.entries());
      subscribers.forEach((subscriber) => subscriber());
    };

    return {
      addOverlay: (key, element) => {
        overlays.set(key, element);
        notify();
      },
      removeOverlay: (key) => {
        if (overlays.delete(key)) {
          notify();
        }
      },
      subscribe: (callback) => {
        subscribers.add(callback);
        return () => {
          subscribers.delete(callback);
        };
      },
      getSnapshot: () => snapshot,
    };
  });

  return (
    <AppOverlayContext.Provider value={context}>
      <View style={styles.root}>
        {children}
        <AppOverlayHost />
      </View>
    </AppOverlayContext.Provider>
  );
}

// Overlays draw above every route, so only the focused screen may own one;
// a blurred screen under a pushed route would otherwise keep dimming it.
export function AppOverlayPortal({ children }: { children: ReactNode }) {
  const context = use(AppOverlayContext);
  const isFocused = useIsFocused();
  const id = useId();

  useLayoutEffect(() => {
    if (isFocused) {
      context?.addOverlay(id, children);
    } else {
      context?.removeOverlay(id);
    }
  }, [children, context, id, isFocused]);

  useLayoutEffect(() => {
    return () => {
      context?.removeOverlay(id);
    };
  }, [context, id]);

  if (context === null) {
    return isFocused ? <>{children}</> : null;
  }

  return null;
}

function AppOverlayHost() {
  const context = use(AppOverlayContext);
  const overlays = useSyncExternalStore(
    context?.subscribe ?? noopSubscribe,
    context?.getSnapshot ?? emptySnapshot,
    context?.getSnapshot ?? emptySnapshot,
  );

  return overlays.map(([key, element]) => (
    <View key={key} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {element}
    </View>
  ));
}

function noopSubscribe() {
  return () => undefined;
}

function emptySnapshot(): OverlaySnapshot {
  return EMPTY_OVERLAY_SNAPSHOT;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
