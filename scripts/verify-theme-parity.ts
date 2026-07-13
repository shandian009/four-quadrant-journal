import { assertThemeParity } from '../src/build/verify-theme-parity';
import { THEMES } from '../src/renderer/theme/themes';

assertThemeParity(THEMES);
console.log(`主题令牌一致：${Object.keys(THEMES).length} 套皮肤`);
