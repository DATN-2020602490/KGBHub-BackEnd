// to make the file a module and avoid the TypeScript error
export {};

declare global {
  namespace globalThis {
    /**
     * Checks a condition and throws an error if the condition is falsy.
     *
     * @param condition - The condition to evaluate. If falsy, an error is thrown.
     * @param message - The error message or an Error object to throw if the condition is falsy.
     *                  If a string is provided, a new Error is created with this message.
     *                  If an Error object is provided, it is thrown directly.
     *
     * @throws {Error} - Throws an error with the provided message if the condition is falsy.
     */
    const check: (condition: any, message: string | Error) => void;
  }
}
