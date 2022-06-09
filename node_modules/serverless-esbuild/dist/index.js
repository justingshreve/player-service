"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const esbuild_1 = require("esbuild");
const fs_extra_1 = __importDefault(require("fs-extra"));
const globby_1 = __importDefault(require("globby"));
const path_1 = __importDefault(require("path"));
const p_map_1 = __importDefault(require("p-map"));
const ramda_1 = require("ramda");
const chokidar_1 = __importDefault(require("chokidar"));
const helper_1 = require("./helper");
const pack_externals_1 = require("./pack-externals");
const pack_1 = require("./pack");
const pre_offline_1 = require("./pre-offline");
const pre_local_1 = require("./pre-local");
const utils_1 = require("./utils");
const constants_1 = require("./constants");
const DEFAULT_BUILD_OPTIONS = {
    bundle: true,
    target: 'node12',
    external: [],
    exclude: ['aws-sdk'],
    nativeZip: false,
    packager: 'npm',
    installExtraArgs: [],
    watch: {
        pattern: './**/*.(js|ts)',
        ignore: [constants_1.WORK_FOLDER, 'dist', 'node_modules', constants_1.SERVERLESS_FOLDER],
    },
    keepOutputDirectory: false,
    packagerOptions: {},
    platform: 'node',
};
class EsbuildServerlessPlugin {
    constructor(serverless, options, logging) {
        this.getCachedOptions = (0, ramda_1.memoizeWith)((0, ramda_1.always)('cache'), () => {
            var _a, _b;
            const runtimeMatcher = helper_1.providerRuntimeMatcher[this.serverless.service.provider.name];
            const target = runtimeMatcher === null || runtimeMatcher === void 0 ? void 0 : runtimeMatcher[this.serverless.service.provider.runtime];
            const resolvedOptions = {
                ...(target ? { target } : {}),
            };
            const withDefaultOptions = (0, ramda_1.mergeRight)(DEFAULT_BUILD_OPTIONS);
            const withResolvedOptions = (0, ramda_1.mergeRight)(withDefaultOptions(resolvedOptions));
            return withResolvedOptions((_b = (_a = this.serverless.service.custom) === null || _a === void 0 ? void 0 : _a.esbuild) !== null && _b !== void 0 ? _b : {});
        });
        this.serverless = serverless;
        this.options = options;
        this.log =
            (logging === null || logging === void 0 ? void 0 : logging.log) ||
                (0, helper_1.buildServerlessV3LoggerFromLegacyLogger)(this.serverless.cli.log, this.options.verbose);
        this.packExternalModules = pack_externals_1.packExternalModules.bind(this);
        this.pack = pack_1.pack.bind(this);
        this.preOffline = pre_offline_1.preOffline.bind(this);
        this.preLocal = pre_local_1.preLocal.bind(this);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore old versions use servicePath, new versions serviceDir. Types will use only one of them
        this.serviceDirPath = this.serverless.config.serviceDir || this.serverless.config.servicePath;
        this.workDirPath = path_1.default.join(this.serviceDirPath, constants_1.WORK_FOLDER);
        this.buildDirPath = path_1.default.join(this.workDirPath, constants_1.BUILD_FOLDER);
        this.hooks = {
            'before:run:run': async () => {
                await this.bundle();
                await this.packExternalModules();
                await this.copyExtras();
            },
            'before:offline:start': async () => {
                await this.bundle(true);
                await this.packExternalModules();
                await this.copyExtras();
                await this.preOffline();
                this.watch();
            },
            'before:offline:start:init': async () => {
                await this.bundle(true);
                await this.packExternalModules();
                await this.copyExtras();
                await this.preOffline();
                this.watch();
            },
            'before:package:createDeploymentArtifacts': async () => {
                await this.bundle();
                await this.packExternalModules();
                await this.copyExtras();
                await this.pack();
            },
            'after:package:createDeploymentArtifacts': async () => {
                await this.cleanup();
            },
            'before:deploy:function:packageFunction': async () => {
                await this.bundle();
                await this.packExternalModules();
                await this.copyExtras();
                await this.pack();
            },
            'after:deploy:function:packageFunction': async () => {
                await this.cleanup();
            },
            'before:invoke:local:invoke': async () => {
                await this.bundle();
                await this.packExternalModules();
                await this.copyExtras();
                await this.preLocal();
            },
        };
    }
    /**
     * Checks if the runtime for the given function is nodejs.
     * If the runtime is not set , checks the global runtime.
     * @param {Serverless.FunctionDefinitionHandler} func the function to be checked
     * @returns {boolean} true if the function/global runtime is nodejs; false, otherwise
     */
    isNodeFunction(func) {
        const runtime = func.runtime || this.serverless.service.provider.runtime;
        const runtimeMatcher = helper_1.providerRuntimeMatcher[this.serverless.service.provider.name];
        return Boolean(runtimeMatcher === null || runtimeMatcher === void 0 ? void 0 : runtimeMatcher[runtime]);
    }
    /**
     * Checks if the function has a handler
     * @param {Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage} func the function to be checked
     * @returns {boolean} true if the function has a handler
     */
    isFunctionDefinitionHandler(func) {
        var _a;
        return Boolean((_a = func) === null || _a === void 0 ? void 0 : _a.handler);
    }
    get functions() {
        const functions = this.options.function
            ? {
                [this.options.function]: this.serverless.service.getFunction(this.options.function),
            }
            : this.serverless.service.functions;
        // ignore all functions with a different runtime than nodejs:
        const nodeFunctions = {};
        for (const [functionAlias, fn] of Object.entries(functions)) {
            if (this.isFunctionDefinitionHandler(fn) && this.isNodeFunction(fn)) {
                nodeFunctions[functionAlias] = fn;
            }
        }
        return nodeFunctions;
    }
    get plugins() {
        if (!this.buildOptions.plugins)
            return;
        const plugins = require(path_1.default.join(this.serviceDirPath, this.buildOptions.plugins));
        if (typeof plugins === 'function') {
            return plugins(this.serverless);
        }
        return plugins;
    }
    get buildOptions() {
        return this.getCachedOptions();
    }
    get rootFileNames() {
        return (0, helper_1.extractFileNames)(this.serviceDirPath, this.serverless.service.provider.name, this.functions);
    }
    async watch() {
        const options = {
            ignored: this.buildOptions.watch.ignore,
            awaitWriteFinish: true,
            ignoreInitial: true,
        };
        chokidar_1.default.watch(this.buildOptions.watch.pattern, options).on('all', () => this.bundle(true)
            .then(() => this.log.verbose('Watching files for changes...'))
            .catch(() => this.log.error('Bundle error, waiting for a file change to reload...')));
    }
    prepare() {
        var _a, _b, _c, _d, _e, _f;
        fs_extra_1.default.mkdirpSync(this.buildDirPath);
        fs_extra_1.default.mkdirpSync(path_1.default.join(this.workDirPath, constants_1.SERVERLESS_FOLDER));
        // exclude serverless-esbuild
        this.serverless.service.package = {
            ...(this.serverless.service.package || {}),
            patterns: [
                ...new Set([
                    ...(((_a = this.serverless.service.package) === null || _a === void 0 ? void 0 : _a.include) || []),
                    ...(((_b = this.serverless.service.package) === null || _b === void 0 ? void 0 : _b.exclude) || []).map((0, ramda_1.concat)('!')),
                    ...(((_c = this.serverless.service.package) === null || _c === void 0 ? void 0 : _c.patterns) || []),
                    '!node_modules/serverless-esbuild',
                ]),
            ],
        };
        for (const fn of Object.values(this.functions)) {
            fn.package = {
                ...(fn.package || {}),
                patterns: [
                    ...new Set([
                        ...(((_d = fn.package) === null || _d === void 0 ? void 0 : _d.include) || []),
                        ...(((_e = fn.package) === null || _e === void 0 ? void 0 : _e.exclude) || []).map((0, ramda_1.concat)('!')),
                        ...(((_f = fn.package) === null || _f === void 0 ? void 0 : _f.patterns) || []),
                    ]),
                ],
            };
        }
    }
    async bundle(incremental = false) {
        var _a;
        this.prepare();
        this.log.verbose(`Compiling to ${this.buildOptions.target} bundle with esbuild...`);
        if (this.buildOptions.disableIncremental === true) {
            incremental = false;
        }
        const bundleMapper = async (bundleInfo) => {
            const { entry, func, functionAlias } = bundleInfo;
            const config = {
                ...this.buildOptions,
                external: [
                    ...this.buildOptions.external,
                    ...(this.buildOptions.exclude === '*' || this.buildOptions.exclude.includes('*')
                        ? []
                        : this.buildOptions.exclude),
                ],
                entryPoints: [entry],
                outdir: path_1.default.join(this.buildDirPath, path_1.default.dirname(entry)),
                incremental,
                plugins: this.plugins,
            };
            // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
            delete config['concurrency'];
            delete config['exclude'];
            delete config['nativeZip'];
            delete config['packager'];
            delete config['packagePath'];
            delete config['watch'];
            delete config['keepOutputDirectory'];
            delete config['packagerOptions'];
            delete config['installExtraArgs'];
            delete config['disableIncremental'];
            const bundlePath = entry.substr(0, entry.lastIndexOf('.')) + '.js';
            if (this.buildResults) {
                const { result } = this.buildResults.find(({ func: fn }) => fn.name === func.name);
                if (result.rebuild) {
                    await result.rebuild();
                    return { result, bundlePath, func, functionAlias };
                }
            }
            const result = await (0, esbuild_1.build)(config);
            if (config.metafile) {
                fs_extra_1.default.writeFileSync(path_1.default.join(this.buildDirPath, `${(0, utils_1.trimExtension)(entry)}-meta.json`), JSON.stringify(result.metafile, null, 2));
            }
            return { result, bundlePath, func, functionAlias };
        };
        this.log.verbose(`Compiling with concurrency: ${(_a = this.buildOptions.concurrency) !== null && _a !== void 0 ? _a : 'Infinity'}`);
        this.buildResults = await (0, p_map_1.default)(this.rootFileNames, bundleMapper, {
            concurrency: this.buildOptions.concurrency,
        });
        this.log.verbose('Compiling completed.');
        return this.buildResults.map((r) => r.result);
    }
    /** Link or copy extras such as node_modules or package.patterns definitions */
    async copyExtras() {
        const { service } = this.serverless;
        // include any "extras" from the "patterns" section
        if (service.package.patterns.length > 0) {
            const files = await (0, globby_1.default)(service.package.patterns);
            for (const filename of files) {
                const destFileName = path_1.default.resolve(path_1.default.join(this.buildDirPath, filename));
                const dirname = path_1.default.dirname(destFileName);
                if (!fs_extra_1.default.existsSync(dirname)) {
                    fs_extra_1.default.mkdirpSync(dirname);
                }
                if (!fs_extra_1.default.existsSync(destFileName)) {
                    fs_extra_1.default.copySync(path_1.default.resolve(filename), destFileName);
                }
            }
        }
        // include any "extras" from the individual function "patterns" section
        for (const [functionAlias, fn] of Object.entries(this.functions)) {
            if (fn.package.patterns.length === 0) {
                continue;
            }
            const files = await (0, globby_1.default)(fn.package.patterns);
            for (const filename of files) {
                const destFileName = path_1.default.resolve(path_1.default.join(this.buildDirPath, `${constants_1.ONLY_PREFIX}${functionAlias}`, filename));
                const dirname = path_1.default.dirname(destFileName);
                if (!fs_extra_1.default.existsSync(dirname)) {
                    fs_extra_1.default.mkdirpSync(dirname);
                }
                if (!fs_extra_1.default.existsSync(destFileName)) {
                    fs_extra_1.default.copySync(path_1.default.resolve(filename), destFileName);
                }
            }
        }
    }
    /**
     * Move built code to the serverless folder, taking into account individual
     * packaging preferences.
     */
    async moveArtifacts() {
        const { service } = this.serverless;
        await fs_extra_1.default.copy(path_1.default.join(this.workDirPath, constants_1.SERVERLESS_FOLDER), path_1.default.join(this.serviceDirPath, constants_1.SERVERLESS_FOLDER));
        if (service.package.individually || this.options.function) {
            Object.values(this.functions).forEach((func) => {
                func.package.artifact = path_1.default.join(this.serviceDirPath, constants_1.SERVERLESS_FOLDER, path_1.default.basename(func.package.artifact));
            });
            return;
        }
        service.package.artifact = path_1.default.join(this.serviceDirPath, constants_1.SERVERLESS_FOLDER, path_1.default.basename(service.package.artifact));
    }
    async cleanup() {
        await this.moveArtifacts();
        // Remove temp build folder
        if (!this.buildOptions.keepOutputDirectory) {
            fs_extra_1.default.removeSync(path_1.default.join(this.workDirPath));
        }
    }
}
module.exports = EsbuildServerlessPlugin;
