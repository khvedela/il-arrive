import { appEnv } from './env.validation';

export const config = {
  validate: (value: Record<string, unknown>) => appEnv.parse(value),
};
