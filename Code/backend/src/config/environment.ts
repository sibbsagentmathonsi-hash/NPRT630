import dotenv from 'dotenv';
import { resolve } from 'node:path';

export const loadEnvironment = (): void => {
  dotenv.config({
    path: [resolve(__dirname, '../../../.env'), resolve(__dirname, '../../.env')],
  });
};
