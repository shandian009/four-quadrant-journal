// @vitest-environment node
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('packaged renderer configuration', () => {
  it('uses relative asset URLs so Electron can load them from file://', () => {
    expect(viteConfig).toMatchObject({ base: './' });
  });
});
