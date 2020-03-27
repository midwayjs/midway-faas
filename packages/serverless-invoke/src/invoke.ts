import { InvokeCore } from './core';
import { createRuntime } from '@midwayjs/runtime-mock';
import * as FCTrigger from '@midwayjs/serverless-fc-trigger';
import { Instance, Hooks, loadHandler , getTrigger, getUserFaaSHandlerFunction} from './func';

const hookInvokeServerless = async (instance: Instance) => {
  let invoke;
  let runtime;
  let triggerMap;
  const provider = instance.spec && instance.spec.provider && instance.spec.provider.name;
  if (provider) {
    let handler: any = '';
    if (provider === 'fc' || provider === 'aliyun') {
      handler = await loadHandler(instance, require.resolve('@midwayjs/serverless-fc-starter'));
      triggerMap = FCTrigger;
    } else if (provider === 'scf' || provider === 'tencent') {
      handler = await loadHandler(instance, require.resolve('@midwayjs/serverless-scf-starter'));
    }
    if (handler) {
      runtime = createRuntime({
        handler
      });
    }
  }

  if (runtime) {
    invoke = async (...args) => {
      const trigger = getTrigger(instance, triggerMap, args);
      await runtime.start();
      const result = await runtime.invoke(...trigger);
      await runtime.close();
      return result;
    };
  }
  if (!invoke) {
    invoke = await getUserFaaSHandlerFunction(instance);
  }
};

export const ServerlessInvokeHooks = Hooks.map(hook => {
  if (hook.hook === 'hookInvoke') {
    return { hook: 'hookInvokeServerless', func: hookInvokeServerless };
  }
  return hook;
});

/**
 * 1、社区平台，找到入口，执行入口 + 参数
 * 2、自定义运行时，执行运行时的 invoke 方法 + 参数
 */
export class Invoke extends InvokeCore {
  getHooks() {
    return ServerlessInvokeHooks;
  }
}
