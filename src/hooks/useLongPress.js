import { useCallback, useEffect, useRef } from 'react';

export default function useLongPress(onAction, { delay = 400, interval = 80 } = {}) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const isPressed = useRef(false);

  const clear = useCallback(() => {
    isPressed.current = false;
    window.clearTimeout(timerRef.current);
    window.clearInterval(intervalRef.current);
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback((e) => {
    e.preventDefault();
    if (isPressed.current) return;
    isPressed.current = true;
    onActionRef.current();
    timerRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => onActionRef.current(), interval);
    }, delay);
  }, [delay, interval]);

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
