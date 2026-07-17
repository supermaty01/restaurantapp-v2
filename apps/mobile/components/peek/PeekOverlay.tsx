import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/context/ThemeContext';

import PeekContent from './PeekContent';
import { PeekSession } from './types';

interface PeekOverlayProps {
  activeSession: PeekSession | null;
  isPeeking: boolean;
}

const SCREEN = Dimensions.get('window');
const MAX_CARD_WIDTH = 340;
const HORIZONTAL_PADDING = 20;
const TOP_PADDING = 30;
const TARGET_RADIUS = 16;

export default function PeekOverlay({ activeSession, isPeeking }: PeekOverlayProps) {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [displayedSession, setDisplayedSession] = useState<PeekSession | null>(null);
  const [targetHeight, setTargetHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    setDisplayedSession(activeSession);
    setTargetHeight(null);
    progress.stopAnimation();
    contentOpacity.stopAnimation();
    progress.setValue(0);
    contentOpacity.setValue(0);
  }, [activeSession, contentOpacity, progress]);

  useEffect(() => {
    if (!displayedSession) {
      return;
    }

    if (isPeeking && targetHeight !== null) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: 130,
          useNativeDriver: false,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 90,
          delay: 15,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!isPeeking) {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 0,
          duration: 95,
          useNativeDriver: false,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setDisplayedSession(null);
          setTargetHeight(null);
        }
      });
    }
  }, [contentOpacity, displayedSession, isPeeking, progress, targetHeight]);

  const targetWidth = Math.min(SCREEN.width - HORIZONTAL_PADDING * 2, MAX_CARD_WIDTH);
  const targetLeft = (SCREEN.width - targetWidth) / 2;
  const targetTop = insets.top + TOP_PADDING;
  const visible = displayedSession !== null;

  const animatedStyles = useMemo(() => {
    if (!displayedSession) {
      return null;
    }

    const { sourceRect, sourceBorderRadius } = displayedSession;
    const endHeight = targetHeight ?? sourceRect.height;

    return {
      backdropOpacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.5],
      }),
      top: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceRect.y, targetTop],
      }),
      left: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceRect.x, targetLeft],
      }),
      width: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceRect.width, targetWidth],
      }),
      height: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceRect.height, endHeight],
      }),
      borderRadius: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [sourceBorderRadius, TARGET_RADIUS],
      }),
    };
  }, [displayedSession, progress, targetHeight, targetLeft, targetTop, targetWidth]);

  if (!displayedSession || !animatedStyles) {
    return null;
  }

  const cardBody = (
    <>
      <PeekContent data={displayedSession.preview} />
      <View
        style={[
          styles.footer,
          { borderTopColor: isDarkMode ? '#444444' : '#E0E0E0' },
        ]}
      >
        <Text
          style={{
            color: isDarkMode ? '#888' : '#999',
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          Suelta para cerrar
        </Text>
      </View>
    </>
  );

  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.backdrop,
          { opacity: animatedStyles.backdropOpacity },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.card,
          {
            top: animatedStyles.top,
            left: animatedStyles.left,
            width: animatedStyles.width,
            height: animatedStyles.height,
            borderRadius: animatedStyles.borderRadius,
            backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
          },
        ]}
      >
        <Animated.View style={{ opacity: contentOpacity }}>
          {cardBody}
        </Animated.View>
      </Animated.View>

      <View pointerEvents="none" style={styles.measureContainer}>
        <View
          style={[
            styles.measureCard,
            {
              width: targetWidth,
              backgroundColor: isDarkMode ? '#2A2A2A' : '#FFFFFF',
            },
          ]}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && nextHeight !== targetHeight) {
              setTargetHeight(nextHeight);
            }
          }}
        >
          {cardBody}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 1000,
  },
  card: {
    position: 'absolute',
    zIndex: 1001,
    overflow: 'hidden',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  measureContainer: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    opacity: 0,
  },
  measureCard: {
    borderRadius: TARGET_RADIUS,
    padding: 16,
  },
});
