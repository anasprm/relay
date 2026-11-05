module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/web/postcss.config.mjs { CONFIG => \"[project]/web/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/1-4i_20v-8wlfss9m1._.js",
  "chunks/[root-of-the-server]__17pn3jjqv9c44._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/web/postcss.config.mjs { CONFIG => \"[project]/web/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];