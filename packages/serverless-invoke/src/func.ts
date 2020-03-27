import {
  tsCompile,
  tsIntegrationProjectCompile,
  compareFileChange,
  copyFiles,
} from '@midwayjs/faas-util-ts-compile';
import { Locator } from '@midwayjs/locate';
import { cleanTarget } from './utils';
import { join, resolve, relative } from 'path';
import {
  existsSync,
  move,
  writeFileSync,
  ensureFileSync,
  remove,
} from 'fs-extra';

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

export interface Instance {
  baseDir: string;
  buildDir: string;
  sourceDir: string;
  specFile: string;
  package: {
    include: any;
    exclude;
  };
  debug: any;
  clean: boolean;
  incremental: boolean;
}

const lockMap = {};

export const formatOptions = (options: InvokeOptions) => {
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

export const copyFile = async (instance: Instance) => {
  const packageObj: any = instance.package || {};
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

export const buildTS = async (instance: Instance) => {
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
