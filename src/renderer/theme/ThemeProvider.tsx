import type { PropsWithChildren } from 'react';
import type { ThemeId } from './resolve-theme';
import { themeStyle } from './themes';

export function ThemeProvider({ themeId, children }: PropsWithChildren<{ themeId: ThemeId }>) {
  return (
    <div data-theme={themeId} style={themeStyle(themeId)}>
      {children}
    </div>
  );
}
