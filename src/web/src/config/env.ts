import * as z from 'zod';

// Every env variable must be declared and validated here.
// Vite only exposes variables prefixed with VITE_APP_ (the prefix is stripped).
const EnvSchema = z.object({
  API_URL: z.string().min(1),
  ENABLE_API_MOCKING: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  // Wallet de Juan en el Test Wallet, solo para mostrarla en su panel.
  JUAN_WALLET_ADDRESS: z.string().min(1).optional(),
});

const createEnv = () => {
  const envVars = Object.entries(import.meta.env).reduce<
    Record<string, string>
  >((acc, [key, value]) => {
    if (key.startsWith('VITE_APP_')) {
      acc[key.replace('VITE_APP_', '')] = String(value);
    }
    return acc;
  }, {});

  const parsedEnv = EnvSchema.safeParse(envVars);

  if (!parsedEnv.success) {
    throw new Error(
      `Invalid env provided. The following variables are missing or invalid:\n${parsedEnv.error.issues
        .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }

  return parsedEnv.data;
};

export const env = createEnv();
