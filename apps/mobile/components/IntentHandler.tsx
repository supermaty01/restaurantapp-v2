import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { SHARE_FILE_EXTENSION } from '@/services/share/types';

/**
 * Component that handles incoming intents/deep links for file imports.
 * Must be rendered inside the navigation context.
 */
export function IntentHandler() {
  const router = useRouter();
  const hasHandledInitialUrl = useRef(false);

  useEffect(() => {
    // Handle initial URL when app opens from a file
    const checkInitialUrl = async () => {
      if (hasHandledInitialUrl.current) return;
      
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('[IntentHandler] Initial URL:', initialUrl);
        
        if (initialUrl && isShareFileUrl(initialUrl)) {
          hasHandledInitialUrl.current = true;
          const fileUri = extractFileUri(initialUrl);
          console.log('[IntentHandler] Extracted file URI:', fileUri);
          
          if (fileUri) {
            // Wait a bit for the app to fully initialize
            setTimeout(() => {
              router.push({ pathname: '/import', params: { uri: encodeURIComponent(fileUri) } });
            }, 500);
          }
        }
      } catch (error) {
        console.error('[IntentHandler] Error checking initial URL:', error);
      }
    };

    checkInitialUrl();

    // Listen for incoming URLs while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[IntentHandler] Received URL event:', url);
      
      if (isShareFileUrl(url)) {
        const fileUri = extractFileUri(url);
        console.log('[IntentHandler] Extracted file URI from event:', fileUri);
        
        if (fileUri) {
          router.push({ pathname: '/import', params: { uri: encodeURIComponent(fileUri) } });
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return null;
}

// Check if URL is related to a share file import
function isShareFileUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();
  return (
    lowercaseUrl.includes(SHARE_FILE_EXTENSION) ||
    lowercaseUrl.includes('restoshare') ||
    url.startsWith('content://') ||
    url.startsWith('file://') ||
    // WhatsApp and other apps use content providers
    lowercaseUrl.includes('provider') ||
    lowercaseUrl.includes('media/item')
  );
}

// Extract the file URI from various URL formats
function extractFileUri(url: string): string | null {
  // If already a content:// or file:// URI, use directly
  if (url.startsWith('content://') || url.startsWith('file://')) {
    return url;
  }

  // Handle custom scheme URLs (e.g., myapp://...)
  // Try to extract the content:// portion
  const contentMatch = url.match(/content:\/\/[^\s]+/);
  if (contentMatch) {
    return contentMatch[0];
  }

  const fileMatch = url.match(/file:\/\/[^\s]+/);
  if (fileMatch) {
    return fileMatch[0];
  }

  // If the URL contains a provider path, reconstruct content:// URI
  // e.g., myapp://com.whatsapp.provider.media/item/xxx -> content://com.whatsapp.provider.media/item/xxx
  if (url.includes('provider') || url.includes('.media')) {
    // Remove the scheme part and reconstruct
    const schemePattern = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
    const pathPart = url.replace(schemePattern, '');
    if (pathPart && pathPart !== url) {
      return 'content://' + pathPart;
    }
  }

  console.log('[IntentHandler] Could not extract file URI from:', url);
  return null;
}

