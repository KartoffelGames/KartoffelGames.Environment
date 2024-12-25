import { PackageInformation } from '@kartoffelgames/environment.core';
import { Compiler, OutputFileSystem, webpack } from 'webpack';
import { IFs, Volume, createFsFromVolume } from 'memfs';

// https://webpack.js.org/api/webpack-dev-server/

export class EnvironmentBuild {
    /**
     * Build project package in current enviroment.
     * 
     * @param pProject - Project.
     * @param pPackageInformation - Package information.
     */
    public async build(pProject: Project, pPackageInformation: PackageInformation): Promise<EnvironmentBuildOutput> {

        // Read configuration from package json file.

    }

    /**
     * 
     * @param pProject - Project.
     * @param pPackageInformation - Package information.
     *  
     * @returns Build output of webpack build. 
     */
    private async buildWithWebpack(pProject: Project, pPackageInformation: PackageInformation): Promise<EnvironmentBuildOutput> {
        const lResult: EnvironmentBuildOutput = {
            files: new Array<EnvironmentBuildedFile>(),
            console: ''
        };

        const lMemoryFileSystem: IFs = createFsFromVolume(new Volume());

        const lWebPack: Compiler = webpack({
            devtool: 'source-map',
            target: 'web',
            entry: lBuildSettings.entryFile,
            mode: 'production',
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
        });
        lWebPack.outputFileSystem = lMemoryFileSystem as unknown as OutputFileSystem;

        return new Promise<EnvironmentBuildOutput>((pResolve, pReject) => {
            lWebPack.run((pError, pStats) => {
                // Reject on error.
                if (pError || !pStats) {
                    // Append error message to console output.
                    lResult.console = pError?.toString() ?? '';

                    // Reject on error.
                    pReject(lResult);
                    return;
                }

                // Output stats.
                lResult.console += pStats.toString();

                // Reject on compilation error.
                if (pStats?.hasErrors()) {
                    // Reject on error.
                    pReject(lResult);
                    return;
                }

                // Close webpack compiler.
                lWebPack.close((pError) => {
                    // Reject on error.
                    if (pError) {
                        pReject(pError);
                        return;
                    }

                    // Read build and map output from memory file system.
                    lResult.code = lMemoryFileSystem.readFileSync('...') as string;
                    lResult.soureMap = lMemoryFileSystem.readFileSync('...') as string;

                    // Resolve on close.
                    pResolve(lResult);
                });
            });
        });
    }
}

export type EnvironmentBuildOutput = {
    files: Array<EnvironmentBuildedFile>;
    console: string;
};

export type EnvironmentBuildedFile = {
    code: string;
    soureMap: string;
};