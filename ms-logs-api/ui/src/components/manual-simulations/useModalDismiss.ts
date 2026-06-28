import { useEffect, useRef } from 'react';

/**
 * Standard modal chrome shared by every overlay in this feature:
 * close on Escape and lock body scroll while the modal is mounted.
 *
 * onClose is read through a ref so the effect runs only on mount/unmount —
 * a parent re-render passing a fresh onClose must NOT re-toggle body scroll
 * (that would leak `overflow: hidden` onto the page).
 */
export function useModalDismiss(onClose: () => void): void {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onCloseRef.current();
        }
        document.addEventListener('keydown', handleKeyDown);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, []);
}
