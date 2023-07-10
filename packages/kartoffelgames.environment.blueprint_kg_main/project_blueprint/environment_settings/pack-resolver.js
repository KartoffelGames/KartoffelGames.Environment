// @ts-check
module.exports = class Resolver {
    _packLoader;

    /**
     * Constructor.
     * @param {object} pPackLoader - Pack loader. 
     */
    constructor(pPackLoader) {
        this._packLoader = pPackLoader;
    }

    /**
     * Load wp loader list from file extensions of module declaration files.
     */
    loadFileModules() {
        const lExtensionList = new Set([
            ...this._packLoader.loadModuleExtensions(`${this._packLoader.projectDirectory}/environment_settings/module-declaration.d.ts`),
            ...this._packLoader.loadModuleExtensions(`${this._packLoader.packageDirectory}/environment_settings/module-declaration.d.ts`),
        ]);

        // Create loader setting list from extensions.
        const lLoaderList = [];
        for (const lExtension of lExtensionList) {
            const lExtensionRegex = new RegExp(lExtension.replace('.', '\\.') + '$');

            switch (lExtension) {
                case '*.css':
                case '*.html':
                case '*.txt':
                case '*.json': {
                    lLoaderList.push({
                        test: lExtensionRegex,
                        use: {
                            loader: 'raw-loader'
                        }
                    });
                    break;
                }
                case '*.png':
                case '*.jpg':
                case '*.jpeg':
                case '*.gif': {
                    lLoaderList.push({
                        test: lExtensionRegex,
                        use: {
                            loader: 'url-loader'
                        }
                    });
                    break;
                }
                case '*.jsworker': {
                    lLoaderList.push({
                        test: lExtensionRegex,
                        use: {
                            loader: 'url-loader',
                            options: { mimetype: 'application/javascript' }
                        }
                    });
                    break;
                }
            }
        }

        return lLoaderList;
    }

    /**
     * Get default loader for typescript files. 
     * @param pIncludeCoverage - Include coverage loader.
     */
    loadTypescriptLoader(pIncludeCoverage) {
        const lTsLoader = new Array();

        // KEEP LOADER-ORDER!!!

        // Add coverage loader if coverage is enabled.
        if (pIncludeCoverage) {
            lTsLoader.push({ loader: '@jsdevtools/coverage-istanbul-loader' });
        }

        // Add default typescript loader.
        lTsLoader.push({
            loader: 'babel-loader',
            options: {
                plugins: ['@babel/plugin-transform-async-to-generator'],
                presets: []
            }
        });
        lTsLoader.push({
            loader: 'ts-loader',
        });

        return lTsLoader;
    };

    /**
     * Resolve webpack config.
     */
    resolve() {
        const lBuildSettings = this._packLoader.autoConfig();

        return {
            devtool: 'source-map',
            target: lBuildSettings.target,
            entry: lBuildSettings.entryFile,
            mode: lBuildSettings.buildMode,
            output: {
                filename: `../${lBuildSettings.outputDirectory}/${lBuildSettings.fileName}.${lBuildSettings.fileExtension}`, // ".." because Dist is the staring directory.
                library: lBuildSettings.libraryName
            },
            resolve: {
                extensions: ['.ts', '.js']
            },
            context: this._packLoader.packageDirectory,
            module: {
                rules: [{
                    test: /\.ts?$/,
                    use: this.loadTypescriptLoader(lBuildSettings.coverage ?? false),
                    exclude: /node_modules|\.d\.ts$/
                },
                {
                    test: /\.d\.ts$/,
                    loader: 'ignore-loader'
                },
                ...this.loadFileModules()
                ]
            },
            watch: false,
            watchOptions: {
                aggregateTimeout: 1000,
                ignored: /node_modules/,
                poll: 1000
            },
            devServer: {
                open: true,
                liveReload: true,
                static: {
                    directory: lBuildSettings.serveDirectory,
                    watch: true
                },
                compress: true,
                port: 5500,
                client: {
                    logging: 'info',
                    overlay: true,
                },
                devMiddleware: {
                    writeToDisk: true,
                }
            },
        };
    }
};