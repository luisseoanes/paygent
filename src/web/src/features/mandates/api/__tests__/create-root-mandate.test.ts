import { toRootMandateBody } from '../create-root-mandate';

const COP = { assetCode: 'COP', assetScale: 2 };
const USD = { assetCode: 'USD', assetScale: 2 };

test('the root grant is requested in the currency of Juan’s wallet', () => {
  const values = { maxDebit: 1_200_000, periodo: 'mes' as const };
  expect(toRootMandateBody(values, COP).maxDebit).toEqual({
    value: '120000000',
    ...COP,
  });
  expect(toRootMandateBody({ ...values, maxDebit: 300 }, USD).maxDebit).toEqual(
    {
      value: '30000',
      ...USD,
    },
  );
});
