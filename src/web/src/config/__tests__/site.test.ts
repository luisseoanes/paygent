import { landingSections } from '../paths';
import { siteConfig } from '../site';

test('every navbar button jumps to a section of the landing page', () => {
  expect(siteConfig.mainNav.map((item) => item.href)).toEqual(
    landingSections.map((section) => `/#${section}`),
  );
});
