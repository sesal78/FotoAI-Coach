// Drizzle's snapshot JSON is its model of the database: tables, columns and constraints are
// maps keyed by name, so comparing the parsed objects ignores the catalog order that
// differs between a fresh database (CI) and a long-lived one (dev PC). Only the snapshot
// id fields are dropped; they are random per pull.

import { fixPulledSnapshot } from '../../scripts/fix-pull.ts';

export function comparableSnapshot(json: string): Record<string, unknown> {
  const snapshot = JSON.parse(fixPulledSnapshot(json)) as Record<string, unknown>;
  delete snapshot.id;
  delete snapshot.prevId;
  return snapshot;
}
