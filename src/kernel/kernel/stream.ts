export class IterableReadableStream extends ReadableStream {
  [Symbol.asyncIterator]() {
    const reader = this.getReader();
    return {
      next: () => {
        return new Promise((resolve, reject) => {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                resolve({ done: true });
              } else {
                resolve({ done: false, value });
              }
            })
            .catch(reject);
        });
      },
    };
  }
}
