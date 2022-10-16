// @ts-check

// Load dependencies.
const gPath = require('path');
const gFilereader = require('fs');

/**
 * Load default loader from module declaration file.
 */
const gGetDefaultFileLoader = () => {
    // Read module declaration file.
    const lDeclarationFilepath = gPath.resolve(__dirname, '..', 'declaration', 'module-declaration.d.ts');
    const lFileContent = gFilereader.readFileSync(lDeclarationFilepath, 'utf8');

    const lFileExtensionRegex = /declare\s+module\s+(?:"|')\*([.a-zA-Z0-9]+)(?:"|')\s*{.*?\/\*\s*LOADER::([a-zA-Z-]+)\s*\*\/.*?}/gms;

    // Get all declaration informations by reading the extension and the loader information from the comment.
    const lDefaultLoader = [];
    let lMatch;
    while (lMatch = lFileExtensionRegex.exec(lFileContent)) {
        const lExtension = lMatch[1];
        const lLoaderType = lMatch[2];

        // Create regex from extension.
        const lExtensionRegex = new RegExp(lExtension.replace('.', '\\.') + '$');

        // Add loader config.
        lDefaultLoader.push({
            test: lExtensionRegex,
            use: lLoaderType
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

    return lFileJson.projectName;
};

/**
 * Get webpack config.
 * @param pEnvironment - { buildType: 'release' | 'debug' | 'test' | 'scratchpad'; coverage: boolan; }
 */
module.exports = (pEnvironment) => {
    const lProjectName = gGetProjectName().toLowerCase();

    // Set variable configuration default values.
    const lBuildSettings = {
        target: 'node',
        entryFile: '',
        buildMode: 'none',
        fileName: 'script.js',
        outputDirectory: './library/build',
        includeCoverage: false
    };

    switch (pEnvironment.buildType) {
        case 'release':
            lBuildSettings.target = 'web';
            lBuildSettings.entryFile = './source/index.ts';
            lBuildSettings.buildMode = 'production';
            lBuildSettings.fileName = `${lProjectName}.js`;
            lBuildSettings.outputDirectory = './library/build';
            lBuildSettings.includeCoverage = false;
            break;

        case 'test':
            lBuildSettings.target = 'node';
            lBuildSettings.entryFile = './test/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = `test-pack.js`;
            lBuildSettings.outputDirectory = './library/build';
            lBuildSettings.includeCoverage = false;
            break;

        case 'test-coverage':
            lBuildSettings.target = 'node';
            lBuildSettings.entryFile = './test/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = `test-pack.js`;
            lBuildSettings.outputDirectory = './library/build';
            lBuildSettings.includeCoverage = true;
            break;

        case 'scratchpad':
            lBuildSettings.target = 'web';
            lBuildSettings.entryFile = './scratchpad/source/index.ts';
            lBuildSettings.buildMode = 'development';
            lBuildSettings.fileName = 'scratchpad.js';
            lBuildSettings.outputDirectory = 'dist';
            lBuildSettings.includeCoverage = false;
            break;
    }

    return {
        devtool: 'source-map',
        target: lBuildSettings.target,
        entry: lBuildSettings.entryFile,
        mode: lBuildSettings.buildMode,
        output: {
            filename: `../${lBuildSettings.outputDirectory}/${lBuildSettings.fileName}` // ".." because Dist is the staring directory.
        },
        resolve: {
            extensions: ['.ts', '.js']
        },
        context: gPath.resolve('./'),
        module: {
            rules: [{
                    test: /\.ts?$/,
                    use: gGetDefaultTypescriptLoader(lBuildSettings.includeCoverage)
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
                directory: "./scratchpad",
                watch: true
            },
            compress: true,
            port: 5500,
            client: {
                logging: 'info',
                overlay: true,
            }
        },
    };
};