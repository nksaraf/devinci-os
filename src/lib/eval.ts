export function evalWithContext(source, context) {
  return getEvalSyncFn(source, context)();
}

export function importScripts(): (...urls: string[]) => void {
  return (model) => {
    console.debug('IMPORTING', model);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', model, false);
    xhr.send();
    // look ma, i'm synchronous (•‿•)
    console.debug('json response', xhr.responseText);
    let result = xhr.responseText.length > 0 ? xhr.responseText : 'null';

    evalWithContext(result, globalThis);

    return result;
  };
}

export function getEvalSyncFn(source, context) {
  const executor = Function(`
    return (context) => {
      try {
          with (context) {
            let fn = function() {
              ${source}
            }

            // binding here so that global variable is available
            // as this to the top level iife type functions
            boundFn = fn.bind(context);

            return boundFn();
          }
      }  catch(e) {
        console.error('Error thrown from eval', e);
        throw e;
      }
    };
  `)();

  return () => {
    executor.bind(context)(context);
  };
}

export function getEvalAsyncFunction(source, context) {
  const executor = Function(`
    return async (context) => {
      try {
          with (context) {
            let fn = async function() {
              ${source}
            }

            boundFn = fn.bind(context);

            return await boundFn();
          }
      }  catch(e) {
        throw e;
      }
    };
  `)();

  return async () => {
    return await executor.bind(context)(context);
  };
}
