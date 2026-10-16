import { paths } from '../paths';

test('the link code Juan shares opens María with the branch id', () => {
  expect(paths.maria.getHref('maria-device')).toBe(
    '/maria?vincular=maria-device',
  );
});
