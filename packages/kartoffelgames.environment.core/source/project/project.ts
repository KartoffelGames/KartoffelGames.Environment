import { CliPackages } from '../cli/cli-packages.ts';
import { FileSystem } from '../system/file-system.ts';
import { Package } from "./package.ts";

export class Project {
    /**
     * Find the project root path by searching for the root package file.
     * 
     * @param pCurrentPath - Current path.
     */
    public static findRoot(pCurrentPath: string): string {
        const lAllFiles: Array<string> = FileSystem.findFiles(pCurrentPath, {
            direction: 'reverse',
            include: {
                fileNames: ['deno.json'],
                extensions: ['json']
            }
        });

        // Root directory names.
        const lRootDirectories: Array<string> = new Array<string>();

        // Load and filter all package files without root set to true.
        for (const lFile of lAllFiles) {
            const lFileContent: string = FileSystem.read(lFile);
            const lPackageJson: ProjectConfigurationFile = JSON.parse(lFileContent);

            if (lPackageJson.kg?.root === true) {
                lRootDirectories.push(FileSystem.directoryOfFile(lFile));
            }
        }

        // Order root directory names by length where the longest is first and the shortest is last.
        lRootDirectories.sort((pFirst, pSecond) => pSecond.length - pFirst.length);

        // Return current directory if no root was found.
        if (lRootDirectories.length !== 0) {
            return lRootDirectories[0];
        } else {
            return pCurrentPath;
        }
    }

    private readonly mCliPackages: CliPackages;
    private readonly mProjectConfiguration: ProjectConfigurationFile;
    private readonly mRootPath: string;

    /**
     * Cli packages.
     */
    public get cliPackages(): CliPackages {
        return this.mCliPackages;
    }

    /**
     * Project root path.
     */
    public get rootDirectory(): string {
        return this.mRootPath;
    }

    /**
     * Projects package directory.
     */
    public get packagesDirectory(): string {
        return FileSystem.pathToAbsolute(this.rootDirectory, this.mProjectConfiguration.kg.packages);
    }

    /**
     * Get the project version.
     */
    public get version(): string {
        return this.mProjectConfiguration.version;
    }

    /**
     * Constructor.
     * 
     * @param pCurrentPath - Project root path.
     * @param pDefaultConfiguration - Default configuration for project.
     */
    public constructor(pCurrentPath: string) {
        // Find project root path.
        const lProjectRootPath: string = Project.findRoot(pCurrentPath);

        // Set project root path and cli packages.
        this.mRootPath = lProjectRootPath;
        this.mCliPackages = new CliPackages(this);

        // Read project json information.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(lProjectRootPath, 'deno.json');
        if (!FileSystem.exists(lPackageJsonPath)) {
            throw new Error(`Project root path "${lProjectRootPath}" has no deno.json file.`);
        }
        const lPackageJsonString: string = FileSystem.read(lPackageJsonPath);
        const lPackageJson: ProjectConfigurationFile = (() => {
            try {
                return JSON.parse(lPackageJsonString);
            } catch (pError) {
                throw new Error(`Project "${lProjectRootPath}" has an invalid deno.json file. ${pError}`);
            }
        })();

        // Ignore all projects where kg config is not set.
        if (lPackageJson.kg?.root !== true) {
            throw new Error(`Project "${lProjectRootPath}" has no kg.root: true specified.`);
        }

        // Set project root configuration. Default any missing values.
        this.mProjectConfiguration = lPackageJson;
        this.mProjectConfiguration.version ??= '0.0.0';
        this.mProjectConfiguration.workspace = lPackageJson.workspace ?? [];
        this.mProjectConfiguration.kg = lPackageJson.kg ?? {
            root: true,
            packages: './packages',
            cli: []
        };

        // Set unset kg defaults.
        this.mProjectConfiguration.kg.root ??= true;
        this.mProjectConfiguration.kg.packages ??= './packages';
        this.mProjectConfiguration.kg.cli ??= [];
    }

    /**
     * Add packages as deno workspace to root project.
     * 
     * @param pWorkspaceFolder - Folder name of workspace.
     */
    public addWorkspace(pPackageDirectory: string): void {
        // Convert to a relative path from the workspace root replace double backslashes with single backslashes and leading with a dot slash.
        let lRelativePackageDirectory: string = FileSystem.pathToRelative(this.rootDirectory, pPackageDirectory);
        lRelativePackageDirectory = `./${lRelativePackageDirectory.replace(/\\/g, '/')}`;

        // Add new workspace folder.
        this.mProjectConfiguration.workspace.push(lRelativePackageDirectory);
    }

    /**
     * Read project configuration.
     * @param pName - Project name.
     */
    public getPackage(pName: string): Package {
        // Construct paths.
        const lPackageInformation: Package | null = this.findPackageByName(pName);
        if (lPackageInformation === null) {
            throw `Package "${pName}" not found.`;
        }

        return lPackageInformation;
    }

    /**
     * Check if package exists.
     * @param pName - Package or project name name.
     */
    public hasPackage(pName: string): boolean {
        const lPackageDirectory: Package | null = this.findPackageByName(pName);
        return lPackageDirectory !== null;
    }

    /**
     * Find package information of name. 
     * 
     * @param pName - Package id name. Can be the package name too.
     * 
     * @returns Package information or null if not found.
     */
    private findPackageByName(pName: string): Package | null {
        // Converts package name to id name. When it is already the id name, the convert does nothing.
        const lPackageIdName: string = Package.nameToId(pName);

        // Read all available packages and find the package with the provided id name.
        const lPackageInformation = this.readAllPackages().find(pPackage => pPackage.id === lPackageIdName);

        return lPackageInformation ?? null;
    }

    /**
     * Read all projects of package.
     */
    public readAllPackages(): Array<Package> {
        // Search all deno.json files of root workspaces. Exclude node_modules.
        const lAllFiles: Array<string> = FileSystem.findFiles(FileSystem.pathToAbsolute(this.packagesDirectory), {
            depth: 1, // ./packages/{package_name}/deno.json
            include: {
                fileNames: ['deno.json'],
                extensions: ['json']
            },
        });

        // Create package list.
        const lPackageList: Array<Package> = new Array<Package>();

        // Search all files.
        for (const lFile of lAllFiles) {
            // Use only the directory of each deno.json file.
            const lPackageDirectory: string = FileSystem.directoryOfFile(lFile);

            // Create and push package settings.
            lPackageList.push(new Package(this, lPackageDirectory));
        }

        return lPackageList;
    }

    /**
     * Save project configuration.
     */
    public save() {
        // Create path to deno.json.
        const lPackageJsonPath: string = FileSystem.pathToAbsolute(this.mRootPath, 'deno.json');

        // Save deno.json.
        FileSystem.write(lPackageJsonPath, JSON.stringify(this.mProjectConfiguration, null, 4));
    }
}

export interface ProjectRootConfiguration {
    root: true;
    packages: string;
    cli: Array<string>;
}

export type ProjectConfigurationFile = {
    [key: string]: any;

    version: string;
    workspace: Array<string>;
    kg: ProjectRootConfiguration;
};