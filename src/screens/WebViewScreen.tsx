import { useState } from 'react';
import { Text } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { CARE_GUIDE_HTML } from '../generated/careGuide';
import { TestIds } from '../testIds';
import { Screen, TopBar } from '../ui/components';
import { Space, Type, useTheme } from '../ui/theme';

export const PAGE_LOADING = 'Loading the care guide…';
export const PAGE_LOADED = 'Care guide loaded';

/**
 * The page is the string form of the bundled care-guide.html, so the web view never touches the network: the page's
 * own Content-Security-Policy allows nothing remote, and any navigation that would leave the page is refused (an
 * in-page link like "Jump to washing" stays). On Android the app has no INTERNET permission at all.
 */
export function allowNavigation(url: string): boolean {
  return url === 'about:blank' || url.startsWith('about:blank#') || url === 'about:srcdoc';
}

export function WebViewScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState(PAGE_LOADING);
  return (
    <Screen testID={TestIds.WEBVIEW_SCREEN}>
      <TopBar title="Care guide" onBack={onBack} />
      <Text testID={TestIds.WEBVIEW_STATUS} accessibilityLiveRegion="polite" style={[Type.label, { color: colors.onSurfaceVariant, paddingHorizontal: Space.lg, paddingVertical: Space.sm }]}>
        {status}
      </Text>
      <WebView
        testID={TestIds.WEBVIEW}
        accessibilityLabel="Care guide page"
        source={{ html: CARE_GUIDE_HTML }}
        // Every origin reaches onShouldStartLoadWithRequest, which decides; a refused link is never opened elsewhere.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request: WebViewNavigation) => allowNavigation(request.url)}
        onLoadEnd={() => setStatus(PAGE_LOADED)}
        javaScriptEnabled
        // The artifact NthCase installs is a test build, so Appium may switch into the page's WEBVIEW context.
        webviewDebuggingEnabled
        allowFileAccess={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        cacheEnabled={false}
        incognito
        style={{ flex: 1, backgroundColor: colors.surface }}
      />
    </Screen>
  );
}
