import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, StyleProp, View, ViewStyle } from 'react-native';

import { PeekPreviewData } from '@/components/peek/types';
import { usePeekActions } from '@/lib/context/PeekContext';

const LONG_PRESS_DELAY = 150;
const MOVE_CANCEL_THRESHOLD = 12;

interface PeekablePressableProps {
  children: React.ReactNode;
  previewData: PeekPreviewData;
  style?: StyleProp<ViewStyle>;
  className?: string;
  onPress?: () => void;
  scaleValue?: number;
  baseOpacity?: number;
  sourceBorderRadius?: number;
}

const PeekablePressable: React.FC<PeekablePressableProps> = ({
  children,
  previewData,
  style,
  className,
  onPress,
  scaleValue = 1.03,
  baseOpacity = 1,
  sourceBorderRadius = 16,
}) => {
  const { beginPeek, endPeek } = usePeekActions();
  const containerRef = useRef<View>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPeekingRef = useRef(false);
  const movedBeforePeekRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const animateScale = useCallback((toValue: number) => {
    Animated.spring(scaleAnim, {
      toValue,
      friction: 7,
      tension: 130,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const clearLongPressTimeout = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const closePeek = useCallback(() => {
    if (!isPeekingRef.current) {
      return;
    }

    isPeekingRef.current = false;
    animateScale(1);
    endPeek();
  }, [animateScale, endPeek]);

  const openPeek = useCallback(() => {
    if (!containerRef.current || movedBeforePeekRef.current) {
      return;
    }

    isPeekingRef.current = true;

    containerRef.current.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        isPeekingRef.current = false;
        return;
      }

      animateScale(scaleValue);
      beginPeek({
        preview: previewData,
        sourceRect: { x, y, width, height },
        sourceBorderRadius,
      });
    });
  }, [animateScale, beginPeek, previewData, scaleValue, sourceBorderRadius]);

  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent.changedTouches?.[0];
    touchStartRef.current = touch ? { x: touch.pageX, y: touch.pageY } : null;
    movedBeforePeekRef.current = false;
    isPeekingRef.current = false;
    setIsPressed(true);
    clearLongPressTimeout();
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      openPeek();
    }, LONG_PRESS_DELAY);
  }, [clearLongPressTimeout, openPeek]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (isPeekingRef.current || movedBeforePeekRef.current || !touchStartRef.current) {
      return;
    }

    const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent.changedTouches?.[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.pageX - touchStartRef.current.x;
    const deltaY = touch.pageY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > MOVE_CANCEL_THRESHOLD) {
      movedBeforePeekRef.current = true;
      setIsPressed(false);
      clearLongPressTimeout();
    }
  }, [clearLongPressTimeout]);

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);
    touchStartRef.current = null;
    clearLongPressTimeout();

    if (isPeekingRef.current) {
      closePeek();
      return;
    }

    if (!movedBeforePeekRef.current) {
      onPress?.();
    }
  }, [clearLongPressTimeout, closePeek, onPress]);

  const handleTouchCancel = useCallback(() => {
    setIsPressed(false);
    touchStartRef.current = null;
    clearLongPressTimeout();
    closePeek();
  }, [clearLongPressTimeout, closePeek]);

  useEffect(() => {
    return () => {
      clearLongPressTimeout();
    };
  }, [clearLongPressTimeout]);

  return (
    <View
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={style}
    >
      <Animated.View
        className={className}
        style={{
          opacity: baseOpacity * (isPressed && !isPeekingRef.current ? 0.8 : 1),
          transform: [{ scale: scaleAnim }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
};

export default PeekablePressable;
