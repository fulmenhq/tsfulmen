# Fastify + AJV Formats (uuid, email, uri, ...)

Fastify uses AJV for JSON Schema validation, but `format` support is not fully enabled by default (e.g. `format: "uuid"` may be ignored).

TSFulmen includes `ajv-formats` and exposes a small helper to apply a Fulmen-standard set of formats:

```ts
import Fastify from "fastify";
import { applyFulmenAjvFormats } from "@fulmenhq/tsfulmen/schema";

const fastify = Fastify({
  ajv: {
    plugins: [applyFulmenAjvFormats],
  },
});
```

Notes:

- This enables common formats including `uuid`.
- If you already configure AJV plugins, just add `applyFulmenAjvFormats` to that list.
