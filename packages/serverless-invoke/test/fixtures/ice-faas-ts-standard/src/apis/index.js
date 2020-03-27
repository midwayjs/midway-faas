"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const faas_1 = require("@midwayjs/faas");
let IndexHandler = class IndexHandler {
    /**
     * 发布为 hsf 时
     * 这个参数是 ginkgo 固定的，入参出参都为字符串
     * @param event
     */
    async handler(event) {
        return 'hello http world';
    }
};
__decorate([
    faas_1.inject(),
    __metadata("design:type", Object)
], IndexHandler.prototype, "ctx", void 0);
IndexHandler = __decorate([
    faas_1.provide(),
    faas_1.func('index.handler')
], IndexHandler);
exports.IndexHandler = IndexHandler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiL1VzZXJzL3NvYXIuZ3kvcHJvamVjdC9mYWFzL2dpdGh1Yi9taWR3YXktZmFhcy9wYWNrYWdlcy9zZXJ2ZXJsZXNzLWludm9rZS90ZXN0L2ZpeHR1cmVzL2ljZS1mYWFzLXRzLXN0YW5kYXJkL3NyYy9hcGlzLyIsInNvdXJjZXMiOlsiaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQSx5Q0FNd0I7QUFJeEIsSUFBYSxZQUFZLEdBQXpCLE1BQWEsWUFBWTtJQUd2Qjs7OztPQUlHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFhO1FBQ3pCLE9BQU8sa0JBQWtCLENBQUM7SUFDNUIsQ0FBQztDQUNGLENBQUE7QUFUQztJQURDLGFBQU0sRUFBRTs7eUNBQ1E7QUFGTixZQUFZO0lBRnhCLGNBQU8sRUFBRTtJQUNULFdBQUksQ0FBQyxlQUFlLENBQUM7R0FDVCxZQUFZLENBV3hCO0FBWFksb0NBQVkifQ==