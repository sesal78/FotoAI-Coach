// Rules for root migrations written after the 0001–0003 baseline: they may add, or
// replace a CHECK constraint in place, but never drop data, tables, columns or functions.

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

export function migrationViolations(sql: string): string[] {
  const text = stripComments(sql);
  const statements = text.split(';').map((s) => s.trim()).filter(Boolean);
  const violations: string[] = [];

  for (const statement of statements) {
    if (/\bdrop\s+table\b/i.test(statement)) violations.push(`DROP TABLE: ${statement.slice(0, 60)}`);
    if (/\bdrop\s+column\b/i.test(statement)) violations.push(`DROP COLUMN: ${statement.slice(0, 60)}`);
    if (/\bdrop\s+function\b/i.test(statement)) violations.push(`DROP FUNCTION: ${statement.slice(0, 60)}`);
    if (/^\s*truncate\b/i.test(statement)) violations.push(`TRUNCATE: ${statement.slice(0, 60)}`);
    if (/^\s*delete\s+from\b/i.test(statement) && !/\bwhere\b/i.test(statement)) {
      violations.push(`DELETE without WHERE: ${statement.slice(0, 60)}`);
    }
  }

  const added = new Set([...text.matchAll(/\badd\s+constraint\s+([a-z0-9_]+)/gi)].map((m) => m[1]!.toLowerCase()));
  for (const m of text.matchAll(/\bdrop\s+constraint\s+(?:if\s+exists\s+)?([a-z0-9_]+)/gi)) {
    const name = m[1]!.toLowerCase();
    if (!added.has(name)) violations.push(`DROP CONSTRAINT ${name} without ADD CONSTRAINT ${name}`);
  }
  return violations;
}
