/*
  单进程模式的invoke
  invoke -> （trigger）-> invokeCore -> entrence -> userCode[ts build]
  1. 用户调用invoke
  2. tsc编译用户代码到dist目录
  3. 开源版: 【创建runtime、创建trigger】封装为平台invoke包，提供getInvoke方法，会传入args与入口方法，返回invoke方法
*/
import { Instance, copyFile, buildTS } from './func';
import { FaaSStarterClass, cleanTarget } from './utils';
import { resolve } from 'path';
import { loadSpec, getSpecFile } from '@midwayjs/fcli-command-core';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
import { AnalyzeResult } from '@midwayjs/locate';
import { IInvoke } from './interface';
const lockMap = {};
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

  constructor(options: InvokeOptions) {
    options = this.formatOptions(options);
    this.options = options;
    this.baseDir = this.options.baseDir;
    this.buildDir = resolve(this.baseDir, options.buildDir || 'dist');
    this.spec = loadSpec(this.baseDir);
    this.specFile = getSpecFile(this.baseDir).path;
  }

  protected async getStarter() {
    if (this.starter) {
      return this.starter;
    }
    const { functionName } = this.options;
    const starter = new FaaSStarterClass({
      baseDir: this.buildDir,
      functionName,
    });
    await starter.start();
    this.starter = starter;
    return this.starter;
  }

  // 获取用户代码中的函数方法
  protected async getUserFaaSHandlerFunction() {
    const handler =
      this.options.handler || this.getFunctionInfo().handler || '';
    const starter = await this.getStarter();
    return starter.handleInvokeWrapper(handler);
  }

  protected getFunctionInfo(functionName?: string) {
    functionName = functionName || this.options.functionName;
    return (
      (this.spec && this.spec.functions && this.spec.functions[functionName]) ||
      {}
    );
  }

  abstract async getInvokeFunction();

  waitForTsBuild(buildLogPath, count?) {
    count = count || 0;
    return new Promise(resolve => {
      if (count > 100) {
        return resolve();
      }
      if (lockMap[buildLogPath] === 'waiting') {
        setTimeout(() => {
          this.waitForTsBuild(buildLogPath, count + 1).then(resolve);
        }, 300);
      } else {
        resolve();
      }
    });
  }

  public async invoke(...args: any) {
    const instance: Instance = {
      baseDir: this.baseDir,
      buildDir: this.buildDir,
      package: this.spec.package,
      sourceDir: this.options.sourceDir,
      specFile: this.specFile,
      clean: this.options.clean,
      incremental: this.options.incremental,
      debug: this.debug
    };

    await copyFile(instance);
    await buildTS(instance);
    const invoke = await this.getInvokeFunction();
    const result = await invoke(...args);
    if (this.options.clean) {
      await cleanTarget(this.buildDir);
    }
    return result;
  }

  private async invokeError(err) {
    console.log('[faas invoke error]');
    console.log(err);
    process.exit(1);
  }

  protected async loadHandler(starter: string) {
    const wrapperInfo = await this.makeWrapper(starter);
    const { fileName, handlerName } = wrapperInfo;
    this.wrapperInfo = wrapperInfo;
    try {
      const handler = require(fileName);
      return handler[handlerName];
    } catch (e) {
      this.invokeError(e);
    }
  }

  // 写入口
  private async makeWrapper(starter: string) {
    const funcInfo = this.getFunctionInfo();
    const [handlerFileName, name] = funcInfo.handler.split('.');
    const fileName = resolve(this.buildDir, `${handlerFileName}.js`);

    writeWrapper({
      baseDir: this.baseDir,
      service: {
        layers: this.spec.layers,
        functions: { [this.options.functionName]: funcInfo },
      },
      distDir: this.buildDir,
      starter,
    });
    return { fileName, handlerName: name };
  }

  protected wrapperHandler(handler) {
    return handler;
  }

  private formatOptions(options: InvokeOptions) {
    if (!options.baseDir) {
      options.baseDir = process.cwd();
    }
    // 开启增量编译，则不自动清理目录
    if (options.incremental) {
      options.clean = false;
    }
    if (options.clean !== false) {
      options.clean = true;
    }
    return options;
  }

  debug(...args) {
    if (!this.options.verbose) {
      return;
    }
    console.log('[Verbose] ', ...args);
  }
}
