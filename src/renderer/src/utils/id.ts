import { v4 as uuidv4 } from 'uuid';

/** Generates a RFC-4122 v4 UUID. */
export const uuid = (): string => uuidv4();
