import { Invoke } from './invoke';
import { InvokeOptions } from './interface';
export const getInvoke = (Invoke, otherOptions?) => {
  return async (options: InvokeOptions) => {
    if (!options.data || !options.data.length) {
      options.data = [{}];
    }
    const invokeFun = new Invoke({
      baseDir: options.functionDir,
      functionName: options.functionName,
      handler: options.handler,
      trigger: options.trigger,
      isDebug: options.isDebug,
      sourceDir: options.sourceDir,
      clean: options.clean,
      incremental: options.incremental,
      ...otherOptions
    });
    return invokeFun.invoke([].concat(options.data));
  };
};

export const invoke = getInvoke(Invoke);
