import { useEffect, useRef } from "react";

/**
 * Calls `onEscape` when Escape is pressed while `enabled` is true.
 * Also locks page scroll so a modal doesn't scroll the page behind it.
 */
export default function useEscapeKey(onEscape, enabled = true) {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") handlerRef.current?.(event);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}
