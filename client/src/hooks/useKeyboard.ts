import { useEffect } from "react";

interface KeyboardShortcuts {
  [key: string]: () => void;
}

export function useKeyboard(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const keys: string[] = [];
    let timeout: NodeJS.Timeout;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return;
      }

      // Clear timeout if it exists
      if (timeout) {
        clearTimeout(timeout);
      }

      // Add key to sequence
      keys.push(event.key.toLowerCase());

      // Check for matches
      const sequence = keys.join(' ');
      
      // Check if any shortcut starts with current sequence
      const hasMatch = Object.keys(shortcuts).some(shortcut => 
        shortcut.startsWith(sequence)
      );

      if (hasMatch) {
        // Exact match - execute the shortcut
        if (shortcuts[sequence]) {
          event.preventDefault();
          shortcuts[sequence]();
          keys.length = 0; // Clear the sequence
          return;
        }

        // Partial match - wait for more keys
        timeout = setTimeout(() => {
          keys.length = 0; // Clear sequence after timeout
        }, 1000);
      } else {
        // No match - clear sequence
        keys.length = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [shortcuts]);
}
