import { CodeAny } from '../src/codeAnalysis';
import { resolve } from 'path';
import * as assert from 'assert';
import { Program, CompilerHost, resolveTsConfigFile } from '@midwayjs/mwcc';
describe('/test/code.test.ts', () => {
  it('compareFileChange', async () => {
    const projectDir = resolve(__dirname, './fixtures/baseApp');
    const { config } = resolveTsConfigFile(projectDir);
    const compilerHost = new CompilerHost(projectDir, config);
    const program = new Program(compilerHost);
    const newSpec = await CodeAny({
      program,
    });
    assert(newSpec.functions);
    assert(newSpec.functions['no-handler-and-path'].events.length === 1);
    assert(
      newSpec.functions['no-handler-and-path'].events[0].http.path ===
        '/noHandlerAndPath/handler'
    );
    assert(newSpec.functions['test'].events.length === 1);
    assert(newSpec.functions['index-index'].handler === 'index.index');
    assert(newSpec.functions['multi-deco-index'].events.length === 3);
    assert(
      newSpec.functions['multi-deco-index'].events[0].http.path === '/api/test1'
    );
  });
});
