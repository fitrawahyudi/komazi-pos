// Global patch for structuredClone to gracefully handle Prisma.Decimal, functions,
// and complex prototypes in @grammyjs/conversations state storage & replay.

if (typeof globalThis.structuredClone === 'function' && !globalThis.__pos_clone_patched__) {
  globalThis.__pos_clone_patched__ = true;
  const nativeStructuredClone = globalThis.structuredClone;

  globalThis.structuredClone = function (val, options) {
    try {
      return nativeStructuredClone(val, options);
    } catch (err) {
      if (err && (err.name === 'DataCloneError' || err.code === 25 || String(err).includes('could not be cloned'))) {
        try {
          return JSON.parse(
            JSON.stringify(val, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (typeof value.toNumber === 'function') return value.toNumber();
                if (value.constructor?.name === 'Decimal') return Number(value);
              }
              if (typeof value === 'function') return undefined;
              return value;
            })
          );
        } catch {
          return val;
        }
      }
      throw err;
    }
  };
}
