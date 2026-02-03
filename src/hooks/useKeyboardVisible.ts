import { useState, useEffect, useRef, useCallback } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const previousHeightRef = useRef<number>(0);

  const updateKeyboardState = useCallback(() => {
    if (typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const windowHeight = window.innerHeight;
    const currentHeight = viewport.height;
    const offsetTop = viewport.offsetTop || 0;

    let newKeyboardHeight = 0;
    let keyboardVisible = false;

    if (offsetTop > 100) {
      newKeyboardHeight = offsetTop;
      keyboardVisible = true;
    } else if (windowHeight - currentHeight > 100) {
      newKeyboardHeight = windowHeight - currentHeight;
      keyboardVisible = true;
    }

    setIsKeyboardVisible((prev) => {
      if (keyboardVisible !== prev) {
        if (keyboardVisible) {
          document.body.classList.add('keyboard-visible');
          document.body.style.setProperty('--keyboard-height', `${newKeyboardHeight}px`);
        } else {
          document.body.classList.remove('keyboard-visible');
          document.body.style.removeProperty('--keyboard-height');
        }
        return keyboardVisible;
      }
      return prev;
    });

    setKeyboardHeight((prev) => {
      if (Math.abs(newKeyboardHeight - prev) > 10) {
        return newKeyboardHeight;
      }
      return prev;
    });

    previousHeightRef.current = currentHeight;
  }, []);

  useEffect(() => {
    updateKeyboardState();
  }, [updateKeyboardState]);

  useEffect(() => {
    let rafId: number | undefined;

    const handleResize = () => {
      rafId = requestAnimationFrame(updateKeyboardState);
    };

    const initialTimeout = setTimeout(handleResize, 100);

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize, { passive: true });
    }

    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        setTimeout(handleResize, 300);
      }
    };

    const handleBlur = () => {
      setTimeout(() => {
        setIsKeyboardVisible(false);
        document.body.classList.remove('keyboard-visible');
      }, 300);
    };

    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleBlur, true);

    return () => {
      clearTimeout(initialTimeout);
      if (rafId) cancelAnimationFrame(rafId);
      if (viewport) {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      }
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);
    };
  }, [updateKeyboardState]);

  return { isKeyboardVisible, keyboardHeight };
};
