/*
  单进程模式的invoke
  invoke -> （trigger）-> invokeCore -> entrence -> userCode[ts build]
  1. 用户调用invoke
  2. tsc编译用户代码到dist目录
  3. 开源版: 【创建runtime、创建trigger】封装为平台invoke包，提供getInvoke方法，会传入args与入口方法，返回invoke方法
*/
import { Instance, Hooks, getStarter, getFunctionInfo, formatOptions } from './func';
import { AnalyzeResult } from '@midwayjs/locate';
import { IInvoke } from './interface';
import { resolve } from 'path';
import { loadSpec, getSpecFile } from '@midwayjs/fcli-command-core';
interface InvokeOptions {
  baseDir?: string; // 目录，默认为process.cwd
  functionName: string; // 函数名
  handler?: string; // 函数的handler方法
  trigger?: string; // 触发器
  buildDir?: string; // 构建目录
  sourceDir?: string; // 函数源码目录
  incremental?: boolean; // 开启增量编译 (会无视 clean true)
  clean?: boolean; // 清理调试目录
  verbose?: boolean; // 输出详细日志
}

export abstract class InvokeCore implements IInvoke {
  options: InvokeOptions;
  baseDir: string;
  starter: any;
  spec: any;
  buildDir: string;
  wrapperInfo: any;
  specFile: string;
  codeAnalyzeResult: AnalyzeResult;
  instance: Instance;
  constructor(options: InvokeOptions) {
    options = formatOptions(options);
    this.options = options;
    this.baseDir = this.options.baseDir;
    this.buildDir = resolve(this.baseDir, options.buildDir || 'dist');
    this.spec = loadSpec(this.baseDir);
    this.specFile = getSpecFile(this.baseDir).path;

    this.instance = {
      functionName: options.functionName,
      handler: options.handler,
      spec: this.spec,
      specFile: this.specFile,
      baseDir: this.baseDir,
      buildDir: this.buildDir,
      sourceDir: options.sourceDir,
      clean: options.clean,
      incremental: options.incremental,
      debug: this.debug,
      result: null
    };
  }

  protected async getStarter() {
    return getStarter(this.instance);
  }

  protected getFunctionInfo(functionName?: string) {
    return getFunctionInfo(this.instance, functionName);
  }

  async getInvokeFunction() {
    return (...args) => {
      return args;
    };
  }

  public async invoke(...args: any) {
    this.instance.args = args;
    const Hooks = this.getHooks();
    for (const hook of Hooks) {
      this.debug('hook', hook.hook);
      if (this[hook.hook]) {
        this.debug('hook by user', hook.hook);
        await this[hook.hook](this.instance);
      } else {
        await hook.func(this.instance);
      }
    }
    return this.instance.result;
  }

  getHooks() {
    return Hooks;
  }

  async hookInvoke(instance: Instance) {
    const invoke = await this.getInvokeFunction();
    instance.result = await invoke(...instance.args);
  }

  debug(...args) {
    if (!this.options.verbose) {
      return;
    }
    console.log('[Verbose] ', ...args);
  }
}
