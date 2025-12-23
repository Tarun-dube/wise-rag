// Minimal type declarations for pgvector/pg used by this project
declare module 'pgvector/pg' {
  import { Pool } from 'pg';

  // Register parser for vector type on a pool instance
  export function registerType(pool: Pool): void;

  // Simple Vector wrapper used to pass vector parameters to pg
  export class Vector {
    constructor(values: number[]);
    // Some pgvector helpers may exist — keep minimal surface area
    toPostgres(): any;
  }

  const _default: {
    registerType: typeof registerType;
    Vector: typeof Vector;
  };

  export default _default;
}
