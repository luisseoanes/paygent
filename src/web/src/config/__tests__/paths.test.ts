import { paths } from '../paths';

test('the code a titular shares opens the public link screen', () => {
  expect(paths.enlazar.getHref('maria-device')).toBe(
    '/enlazar?codigo=maria-device',
  );
});
