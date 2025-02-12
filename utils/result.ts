export type Result<T, E = Error> = Success<T> | Failure<E>;

interface Success<T> {
  success: true;
  value: T;
}

interface Failure<E> {
  success: false;
  error: E;
}

export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

export function success(): Success<void>;
export function success<T>(data: T): Success<T>;
export function success<T>(data?: T): Success<T | void> {
  return { success: true, value: data };
}
export const failure = <E>(error: E): Failure<E> => ({ success: false, error });
