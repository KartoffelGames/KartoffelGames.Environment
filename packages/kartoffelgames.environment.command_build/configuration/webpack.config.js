// @ts-check

// Load dependencies.
const gPath = require('path');
const gFilereader = require('fs');

/**
 * Load default loader from module declaration file.
 */
const gGetDefaultFileLoader = () => {
    // Read module declaration file.
    const lDeclarationFilepath = require.resolve('@kartoffelgames/environment.workspace-essentials/declaration/module-declaration.d.ts');
    const lFileContent = gFilereader.readFileSync(lDeclarationFilepath, 'utf8');

    const lFileExtensionRegex = /declare\s+module\s+(?:"|')\*([.a-zA-Z0-9]+)(?:"|')\s*{.*?\/\*\s*LOADER::([a-zA-Z-]+)(\{.*})?\s*\*\/.*?}/gms;

    // Get all declaration informations by reading the extension and the loader information from the comment.
    const lDefaultLoader = [];
    let lMatch;
    while (lMatch = lFileExtensionRegex.exec(lFileContent)) {
        const lExtension = lMatch[1];
        const lLoaderType = lMatch[2];
        const lLoaderOptions = lMatch[3] ? JSON.parse(lMatch[3]) : null;

        // Create regex from extension.
        const lExtensionRegex = new RegExp(lExtension.replace('.', '\\.') + '$');

        let lLoaderDefinition;
        if (lLoaderOptions) {
            lLoaderDefinition = {
                loader: lLoaderType,
                options: lLoaderOptions
            };
        } else {
            lLoaderDefinition = lLoaderType;
        }

        // Add loader config.
        lDefaultLoader.push({
            test: lExtensionRegex,
            use: lLoaderDefinition
        });
    }

    return lDefaultLoader;
};

/**
 * Get default loader for typescript files. 
 * @param pIncludeCoverage - Include coverage loader.
 */
const gGetDefaultTypescriptLoader = (pIncludeCoverage) => {
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
            presets: [
                ['@babel/preset-env', { targets: { esmodules: true } }]
            ]
        }
    });
    lTsLoader.push({
        loader: 'ts-loader',
    });

    return lTsLoader;
};

/**
 * Get project name.
 */
const gGetProjectName = () => {
    const lFilePath = gPath.resolve('package.json');
    const lFileContent = gFilereader.readFileSync(lFilePath, 'utf8');
    const lFileJson = JSON.parse(lFileContent);

    if (!lFileJson.kg || !lFileJson.kg.name || lFileJson.kg.name === '') {
        throw `Project name required. Run "npx kg sync" to generate project names for every package.`;
    }

    return lFileJson.kg.name;
};

/**
 * Get webpack config.
 * @param pEnvironment - { buildType: 'release' | 'debug' | 'test' | 'scratchpad'; coverage: boolan; }
 */
module.exports = (pEnvironment) => {
    const lProjectName = gGetProjectName().toLowerCase();

    // Set variable configuration default values.
    const lBuildSettings = {
        target: pEnvironment.target,
        entryFile: '',
        buildMode: 'none',
        fileName: 'script',
        fileExtension: 'js',
        outputDirectory: './library/build',
        includeCoverage: false,
        serveDirectory: ''
    };

    switch (pEnvironment.buildType) {
        case 'release':
            lBuildSettings.entryFile = './source/index.ts';
            lBuildSettings.buildMode = 'production';
            lBuildSettings.fileName = lProjectName;
            lBuildSettings.outputDirectory = './library/build';
            lBuildSettings.includeCoverage = false;
            lBuildSettings.serveDirectory = ''
            break;

        case 'test':
            lBuildSettings.entryFile = './test/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = `test-pack`;
            lBuildSettings.outputDirectory = './library/build';
            lBuildSettings.includeCoverage = false;
            lBuildSettings.serveDirectory = ''
            break;

        case 'test-coverage':
            lBuildSettings.entryFile = './test/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = `test-pack`;
            lBuildSettings.outputDirectory = './library/build';
            lBuildSettings.includeCoverage = true;
            lBuildSettings.serveDirectory = ''
            break;

        case 'scratchpad':
            lBuildSettings.entryFile = './scratchpad/source/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = 'scratchpad';
            lBuildSettings.outputDirectory = 'dist';
            lBuildSettings.includeCoverage = false;
            lBuildSettings.serveDirectory = './scratchpad'
            break;

        case 'page':
            lBuildSettings.entryFile = './page/source/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = 'page';
            lBuildSettings.outputDirectory = './page/build';
            lBuildSettings.includeCoverage = false;
            lBuildSettings.serveDirectory = './page'
            break;

        default:
            throw `Build type "${pEnvironment.buildType}" not supported.`;
    }

    // Set file extension based on scope.
    switch (pEnvironment.scope) {
        case 'main':
            lBuildSettings.fileExtension = 'js';
            break;
        case 'worker':
            lBuildSettings.fileExtension = 'jsworker';
            break;
        default:
            throw `Scope "${pEnvironment.scope}" not supported.`;
    }

    return {
        devtool: 'source-map',
        target: lBuildSettings.target,
        entry: lBuildSettings.entryFile,
        mode: lBuildSettings.buildMode,
        output: {
            filename: `../${lBuildSettings.outputDirectory}/${lBuildSettings.fileName}.${lBuildSettings.fileExtension}` // ".." because Dist is the staring directory.
        },
        resolve: {
            extensions: ['.ts', '.js']
        },
        context: gPath.resolve('./'),
        module: {
            rules: [{
                    test: /\.ts?$/,
                    use: gGetDefaultTypescriptLoader(lBuildSettings.includeCoverage),
                    exclude: /node_modules|\.d\.ts$/
                },
                {
                    test: /\.d\.ts$/,
                    loader: 'ignore-loader'
                },
                ...gGetDefaultFileLoader()
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
};