/**
 * Node 解析钩子
 *
 * 源码里的相对导入不写扩展名（符合打包器习惯），而 Node 原生 ESM 解析要求显式扩展名。
 * 这个轻量钩子会在解析时补上 .ts / .tsx / index.ts，让测试脚本可以直接运行 TS 源码，
 * 不需要额外的编译步骤。
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CANDIDATES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const needsExtension =
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.[cm]?[jt]sx?$/.test(specifier);

    if (needsExtension && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const extension of CANDIDATES) {
        const candidate = new URL(`${base.href}${extension}`);
        if (existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context);
        }
      }
    }

    return nextResolve(specifier, context);
  },
});
