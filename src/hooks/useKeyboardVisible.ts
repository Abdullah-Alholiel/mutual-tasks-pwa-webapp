import { useState, useEffect, useRef, useCallback } from 'react';

export const useKeyboardVisible = () => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const previousHeightRef = useRef<number>(0);

  const updateKeyboardState = () => {
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

    if (keyboardVisible !== isKeyboardVisible ||
      Math.abs(newKeyboardHeight - keyboardHeight) > 10) {
      setIsKeyboardVisible(keyboardVisible);
      setKeyboardHeight(newKeyboardHeight);

      if (keyboardVisible) {
        document.body.classList.add('keyboard-visible');
        document.body.style.setProperty('--keyboard-height', `${newKeyboardHeight}px`);
      } else {
        document.body.classList.remove('keyboard-visible');
        document.body.style.removeProperty('--keyboard-height');
      }
    }

    previousHeightRef.current = currentHeight;
  };

  useEffect(() => {
    updateKeyboardState();
  }, [updateKeyboardState]);

  useEffect(() => {
    let rafId: number | undefined;

    const handleResize = () => {
      rafId = requestAnimationFrame(updateKeyboardState);
    };

    const initialTimeout = setTimeout(handleResize, 100);

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize, { passive: true });

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
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);
    };
  }, [isKeyboardVisible, keyboardHeight, updateKeyboardState]);

  return { isKeyboardVisible, keyboardHeight };
};
