import {
  tsCompile,
  tsIntegrationProjectCompile,
  compareFileChange,
  copyFiles,
} from '@midwayjs/faas-util-ts-compile';
import { Locator } from '@midwayjs/locate';
import { FaaSStarterClass, cleanTarget } from './utils';
import { join, resolve, relative } from 'path';
import { writeWrapper } from '@midwayjs/serverless-spec-builder';
import {
  existsSync,
  move,
  writeFileSync,
  ensureFileSync,
  remove,
} from 'fs-extra';

export interface Instance {
  args?: any;
  functionName: string;
  handler: string;
  baseDir: string;
  buildDir: string;
  sourceDir: string;
  specFile?: string;
  spec?: {
    package: {
      include: any;
      exclude;
    };
    provider: {
      name: string;
    }
  };
  debug: any;
  clean: boolean;
  incremental: boolean;
  result: any;
  starter?: any;
}

const lockMap = {};

export const formatOptions = (options) => {
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
};

export const HookCopyFile = async (instance: Instance) => {
  const packageObj: any = instance.spec.package || {};
  return copyFiles({
    sourceDir: instance.baseDir,
    targetDir: instance.buildDir,
    include: packageObj.include,
    exclude: packageObj.exclude,
    log: path => {
      instance.debug('copy file', path);
    },
  });
};

const waitForTsBuild = (buildLogPath, count?) => {
  count = count || 0;
  return new Promise(resolve => {
    if (count > 100) {
      return resolve();
    }
    if (lockMap[buildLogPath] === 'waiting') {
      setTimeout(() => {
        waitForTsBuild(buildLogPath, count + 1).then(resolve);
      }, 300);
    } else {
      resolve();
    }
  });
};

export const HookBuildTS = async (instance: Instance) => {
  const { baseDir, buildDir, sourceDir, specFile, debug, clean, incremental } = instance;
  const tsconfig = resolve(baseDir, 'tsconfig.json');
  // 非ts
  if (!existsSync(tsconfig)) {
    return;
  }
  // 设置走编译，扫描 dist 目录
  process.env.MIDWAY_TS_MODE = 'false';
  const debugRoot = buildDir || '.faas_debug_tmp';
  // 分析目录结构
  const locator = new Locator(baseDir);
  const codeAnalyzeResult = await locator.run({
    tsCodeRoot: sourceDir,
    tsBuildRoot: debugRoot,
  });
  instance.buildDir = codeAnalyzeResult.tsBuildRoot;
  if (!codeAnalyzeResult.tsBuildRoot) {
    return;
  }
  const buildLogPath = resolve(instance.buildDir, '.faasTSBuildTime.log');
  if (!lockMap[buildLogPath]) {
    lockMap[buildLogPath] = 'waiting';
  } else if (lockMap[buildLogPath] === 'waiting') {
    await waitForTsBuild(buildLogPath);
  }
  if (existsSync(buildLogPath)) {
    const fileChanges = await compareFileChange(
      [
        specFile,
        `${relative(baseDir, codeAnalyzeResult.tsCodeRoot) || '.'}/**/*`,
      ],
      [buildLogPath],
      { cwd: baseDir }
    );
    if (!fileChanges || !fileChanges.length) {
      lockMap[buildLogPath] = true;
      debug('Auto skip ts compile');
      return;
    }
  }
  lockMap[buildLogPath] = 'waiting';
  ensureFileSync(buildLogPath);
  writeFileSync(buildLogPath, `ts build at ${Date.now()}`);
  // clean directory first
  if (clean) {
    await cleanTarget(instance.buildDir);
  }
  const opts = incremental ? { overwrite: true } : {};
  try {
    if (codeAnalyzeResult.integrationProject) {
      // 一体化调整目录
      await tsIntegrationProjectCompile(baseDir, {
        buildRoot: instance.buildDir,
        tsCodeRoot: codeAnalyzeResult.tsCodeRoot,
        incremental,
        tsConfig: {
          compilerOptions: {
            sourceRoot: codeAnalyzeResult.tsCodeRoot, // for sourceMap
          },
        },
        clean,
      });
    } else {
      await tsCompile(baseDir, {
        tsConfigName: 'tsconfig.json',
        tsConfig: {
          compilerOptions: {
            sourceRoot: resolve(baseDir, 'src'), // for sourceMap
          },
        },
        clean,
      });
      await move(join(baseDir, 'dist'), join(instance.buildDir, 'dist'), opts);
    }
  } catch (e) {
    await remove(buildLogPath);
    lockMap[buildLogPath] = false;
    throw new Error(`Typescript Build Error, Please Check Your FaaS Code!`);
  }
  lockMap[buildLogPath] = true;
  // 针对多次调用清理缓存
  Object.keys(require.cache).forEach(path => {
    if (path.indexOf(instance.buildDir) !== -1) {
      delete require.cache[path];
    }
  });
};

const HookInvoke = async (instance: Instance) => {

};

const HookCleanTargetByInstance = async (instance: Instance) => {
  if (instance.clean) {
    await cleanTarget(instance.buildDir);
  }
};

const makeWrapper = async (instance, starter: string) => {
  const funcInfo = getFunctionInfo(instance);
  const [handlerFileName, name] = funcInfo.handler.split('.');
  const fileName = resolve(instance.buildDir, `${handlerFileName}.js`);

  writeWrapper({
    baseDir: instance.baseDir,
    service: {
      layers: instance.spec.layers,
      functions: { [instance.functionName]: funcInfo },
    },
    distDir: instance.buildDir,
    starter,
  });
  return { fileName, handlerName: name };
};

export const getFunctionInfo = (instance, functionName?) => {
  return (
    (instance.spec && instance.spec.functions && instance.spec.functions[functionName || instance.functionName]) ||
    {}
  );
};

export const getTrigger = (instance, triggerMap, args) => {
  if (!triggerMap) {
    return args;
  }
  let triggerName = instance.trigger;
  if (!triggerName) {
    const funcInfo = getFunctionInfo(instance);
    if (funcInfo.events && funcInfo.events.length) {
      triggerName = Object.keys(funcInfo.events[0])[0];
    }
  }
  const EventClass = triggerMap[triggerName];
  if (EventClass) {
    return [new EventClass(...args)];
  }
  return args;
};

export const loadHandler = async (instance, starter: string) => {
  const wrapperInfo = await makeWrapper(instance, starter);
  const { fileName, handlerName } = wrapperInfo;
  try {
    const handler = require(fileName);
    return handler[handlerName];
  } catch (e) {
    // this.invokeError(e);
  }
};

export const getUserFaaSHandlerFunction = async (instance: Instance) => {
  const handler = instance.handler || getFunctionInfo(instance).handler || '';
  const starter = await getStarter(instance);
  return starter.handleInvokeWrapper(handler);
};

export const getStarter = async (instance: Instance) => {
  if (instance.starter) {
    return instance.starter;
  }
  const starter = new FaaSStarterClass({
    baseDir: instance.buildDir,
    functionName: instance.functionName,
  });
  await starter.start();
  instance.starter = starter;
  return instance.starter;
};

export const Hooks = [
  { hook: 'hookCopyFile', func: HookCopyFile },
  { hook: 'hookBuildTS', func: HookBuildTS },
  { hook: 'hookInvoke', func: HookInvoke },
  { hook: 'hookCleanTarget', func: HookCleanTargetByInstance },
];
