import { deserializeError, serializeError } from "@aklinker1/zero-serialize-error"

export const rpcEncoding = {
  serialize: (value: unknown) => JSON.stringify(serializeError(value)),
  deserialize: (value: string) => deserializeError(JSON.parse(value)),
}
