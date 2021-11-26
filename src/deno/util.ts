export function newPromise<T>() {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: any) => void;
  let promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

export function fakePromise<T>() {
  let v = { promise: undefined, error: undefined, resolve: undefined, reject: undefined };
  v.resolve = (value) => {
    v.promise = value;
  };
  v.reject = (error) => {
    v.error = error;
  };

  return v;
}
