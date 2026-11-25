import Ajv, { type AnySchema, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

export interface SchemaResult {
  valid: boolean;
  errors: string[];
}

// Compiling a schema is the expensive part, so one validator per worker caches compiled schemas.
// Schemas with an $id are registered once and can $ref each other.
export class SchemaValidator {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });

  constructor(schemas: readonly AnySchema[] = []) {
    addFormats(this.ajv);
    for (const schema of schemas) this.ajv.addSchema(schema);
  }

  validate(schema: AnySchema | string, data: unknown): SchemaResult {
    const validator = typeof schema === 'string' ? this.ajv.getSchema(schema) : this.compile(schema);
    if (!validator) throw new Error(`Unknown schema "${JSON.stringify(schema)}"`);
    const valid = validator(data);
    return { valid, errors: valid ? [] : (validator.errors ?? []).map(describe) };
  }

  private compile(schema: AnySchema) {
    const id = typeof schema === 'object' && typeof schema.$id === 'string' ? schema.$id : undefined;
    return (id && this.ajv.getSchema(id)) || this.ajv.compile(schema);
  }
}

function describe(error: ErrorObject): string {
  const where = error.instancePath || '(root)';
  const extra = error.keyword === 'additionalProperties' ? ` "${String(error.params.additionalProperty)}"` : '';
  return `${where} ${error.message ?? error.keyword}${extra}`;
}
