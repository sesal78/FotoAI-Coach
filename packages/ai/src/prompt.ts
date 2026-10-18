// A versioned prompt: fixed instructions, a render function for the user message, and the
// output schema. Instructions never hold user or Google text; render() is the only way in.

import { z } from 'zod';

export interface PromptSpec<I, O> {
  id: string;
  version: number;
  instructions: string;
  render(input: I): string;
  schema: z.ZodType<O>;
}

/**
 * The OpenAI provider sends strict JSON schemas, where every field must be present, so output
 * schemas use `.nullable()` and never `.optional()`. Throws naming the first optional field.
 */
export function assertStrictSchema(schema: z.ZodTypeAny, path = ''): void {
  if (schema instanceof z.ZodOptional) throw new Error(`Output schema field is optional: ${path || '(root)'}`);
  if (schema instanceof z.ZodNullable) return assertStrictSchema(schema.unwrap(), path);
  if (schema instanceof z.ZodArray) return assertStrictSchema(schema.element, `${path}.[]`);
  if (schema instanceof z.ZodEffects) return assertStrictSchema(schema.innerType(), path);
  if (schema instanceof z.ZodObject) {
    for (const [key, value] of Object.entries(schema.shape as Record<string, z.ZodTypeAny>)) {
      assertStrictSchema(value, path ? `${path}.${key}` : key);
    }
  }
}
