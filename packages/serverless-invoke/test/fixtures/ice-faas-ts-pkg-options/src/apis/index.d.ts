import { FunctionHandler, FaaSContext } from '@midwayjs/faas';
export declare class IndexHandler implements FunctionHandler {
    ctx: FaaSContext;
    /**
     * 发布为 hsf 时
     * 这个参数是 ginkgo 固定的，入参出参都为字符串
     * @param event
     */
    handler(event: string): Promise<string>;
}
