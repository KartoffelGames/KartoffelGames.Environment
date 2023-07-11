// @ts-check

// Load dependencies.
const gPath = require('path');
const gFilereader = require('fs');

class PackLoader {
    environment;
    projectDirectory;
    packageDirectory;

    /**
     * Constructor.
     * @param {string} pProjectDirectory - Project root directory. 
     * @param {string} pPackageDirectory - Package root directory.
     */
    constructor(pProjectDirectory, pPackageDirectory, pEnvironment) {
        this.projectDirectory = pProjectDirectory;
        this.packageDirectory = pPackageDirectory;
        this.environment = pEnvironment;
    }

    /**
     * Automatic config.
     */
    autoConfig() {
        const packageName = this.getPackageName();

        // Set variable configuration default values.
        const lBuildSettings = {
            target: this.environment.target ?? 'production',
            entryFile: '',
            buildMode: 'none',
            fileName: packageName,
            fileExtension: 'js',
            outputDirectory: './library/build',
            coverage: this.environment.target ?? false,
            serveDirectory: '',
            libraryName: this.environment.libraryName ?? 'Library'
        };

        switch (this.environment.buildType ?? 'release') {
            case 'release':
                lBuildSettings.entryFile = './source/index.ts';
                lBuildSettings.buildMode = 'production';
                lBuildSettings.fileName = packageName;
                lBuildSettings.outputDirectory = './library/build';
                lBuildSettings.serveDirectory = '';
                break;

            case 'test':
                lBuildSettings.entryFile = './test/index.ts';
                lBuildSettings.buildMode = 'development';
                lBuildSettings.fileName = `test-pack`;
                lBuildSettings.outputDirectory = './library/build';
                lBuildSettings.serveDirectory = '';
                break;

            case 'scratchpad':
                lBuildSettings.entryFile = './scratchpad/source/index.ts';
                lBuildSettings.buildMode = 'development';
                lBuildSettings.fileName = 'scratchpad';
                lBuildSettings.outputDirectory = 'dist';
                lBuildSettings.serveDirectory = './scratchpad';
                break;

            case 'page':
                lBuildSettings.entryFile = './page/source/index.ts';
                lBuildSettings.buildMode = 'development';
                lBuildSettings.fileName = 'page';
                lBuildSettings.outputDirectory = './page/build';
                lBuildSettings.serveDirectory = './page';
                break;

            default:
                throw `Build type "${this.environment.buildType}" not supported.`;
        }

        // Set file extension based on scope.
        switch (this.environment.scope ?? 'main') {
            case 'main':
                lBuildSettings.fileExtension = 'js';
                break;
            case 'worker':
                lBuildSettings.fileExtension = 'jsworker';
                break;
            default:
                throw `Scope "${this.environment.scope}" not supported.`;
        }

        return lBuildSettings;
    }

    /**
     * Get project name.
     */
    getPackageName() {
        const lFilePath = gPath.resolve('package.json');
        const lFileContent = gFilereader.readFileSync(lFilePath, 'utf8');
        const lFileJson = JSON.parse(lFileContent);

        if (!lFileJson.kg || !lFileJson.kg.name || lFileJson.kg.name === '') {
            throw `Package name required. Run "npx kg sync" to generate project names for every package.`;
        }

        return lFileJson.kg.name;
    }

    /**
     * Read all module declarations for file.
     * @param {string} pModuleFilePath - Module file path. 
     */
    loadModuleExtensions(pModuleFilePath) {
        if (!gFilereader.existsSync(pModuleFilePath)) {
            return [];
        }

        const lFileExtensionRegex = /declare\s+module\s+(?:"|')\*([.a-zA-Z0-9]+)(?:"|')/gms;

        // Get all declaration informations by reading the extension and the loader information from the comment.
        const lDefaultLoader = [];
        const lFileContent = gFilereader.readFileSync(pModuleFilePath, 'utf8');

        for (const lMatch of lFileContent.matchAll(lFileExtensionRegex)) {
            const lExtension = lMatch[1];
            lDefaultLoader.push(lExtension);
        }

        return lDefaultLoader;
    }
}

/**
 * Get webpack config.
 * @param pEnvironment - { buildType: 'release' | 'debug' | 'test' | 'scratchpad'; coverage: boolan; libraryName: string; }
 */
module.exports = (pEnvironment) => {
    // Environment variables.
    const environmentValues = pEnvironment;

    // Create module loader class.
    const lPackageRoot = gPath.resolve('./');
    const lProjectRoot = gPath.resolve(lPackageRoot, '../..');
    const lModuleLoader = new PackLoader(lProjectRoot, lPackageRoot, environmentValues);

    // Read pack resolver files paths.
    const lPackageSettingsDirectoryPath = gPath.resolve('environment_settings', 'pack-resolver.js');
    const lProjectSettingsDirectoryPath = gPath.resolve('..', '..', 'environment_settings', 'pack-resolver.js');

    // Load custom resolver from package or project path.
    let lCustomResolverClass
    if(gFilereader.existsSync(lPackageSettingsDirectoryPath)){
        console.log(`Loaded resolver from package "${lPackageSettingsDirectoryPath}"`);
        lCustomResolverClass = require(lPackageSettingsDirectoryPath);
    } else {
        console.log(`Loaded resolver from project "${lProjectSettingsDirectoryPath}"`);
        lCustomResolverClass = require(lProjectSettingsDirectoryPath);
    }

    // Create and execute custom resolver class.
    const lCustomResolver = new lCustomResolverClass(lModuleLoader);

    return lCustomResolver.resolve();
};