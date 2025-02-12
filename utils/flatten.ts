/**
 * Flattens an object into an array of objects, adding an 'id' property to each.
 *
 * @template T - The type of the values in the input object.
 * @param {Object.<string, T>} obj - The input object to flatten.
 * @returns {Array.<{id: string} & T>} An array of objects, each containing an 'id' property and the properties of the original object's value.
 *
 * @example
 * const input = { foo: { bar: 1 }, baz: { qux: 2 } };
 * const result = flatten(input);
 * // Result: [{ id: 'foo', bar: 1 }, { id: 'baz', qux: 2 }]
 */
export const flatten = <T>(obj: { [key: string]: T }) => {
  return Object.entries(obj).map(([key, value]) => ({
    ...value,
    id: key,
    name: key,
  }));
};
