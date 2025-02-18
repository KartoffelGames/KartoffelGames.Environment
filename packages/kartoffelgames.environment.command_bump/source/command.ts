import type { CliCommandDescription, CliParameter, ICliPackageCommand, Package, Project } from '@kartoffelgames/environment-core';

export class KgCliCommand implements ICliPackageCommand {
    /**
     * Command description.
     */
    public get information(): CliCommandDescription {
        return {
            command: {
                description: 'Bump root project version [<newversion> | major | minor | patch]',
                parameters: {
                    root: 'bump',
                    optional: {
                        type: {
                            shortName: 't'
                        }
                    }
                }
            },
            configuration: null
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param pCommandPackages - All cli packages grouped by type.
     */
    public async run(pProject: Project, pPackage: Package | null, pParameter: CliParameter): Promise<void> {
        // Check if package is set.
        if (pPackage) {
            throw new Error('This command does not support package execution');
        }

        // Check if type is set.
        if (!pParameter.has('type')) {
            throw new Error('Type parameter is required');
        }

        // Split current project version into
        const lVersionParts: Array<string> = pProject.version.split('.');
        const lVersion: [number, number, number] = [
            parseInt(lVersionParts[0]) ?? 0,
            parseInt(lVersionParts[1]) ?? 0,
            parseInt(lVersionParts[2]) ?? 0
        ];

        switch (pParameter.get('type')) {
            case 'major':
                lVersion[0]++;
                lVersion[1] = 0;
                lVersion[2] = 0;
                break;
            case 'minor':
                lVersion[1]++;
                lVersion[2] = 0;
                break;
            case 'patch':
                lVersion[2]++;
                break;
            default:
                // Split new version into parts.
                const lNewVersionParts: Array<string> = pParameter.get('type').split('.');
                if (lNewVersionParts.length !== 3) {
                    throw new Error('Invalid version format');
                }

                // Convert string into number array.
                const lNewVersion: [number, number, number] = [
                    parseInt(lNewVersionParts[0]),
                    parseInt(lNewVersionParts[1]),
                    parseInt(lNewVersionParts[2])
                ];

                // Validate new version numbers.
                if (isNaN(lNewVersion[0]) || isNaN(lNewVersion[1]) || isNaN(lNewVersion[2])) {
                    throw new Error('Invalid version format');
                }

                // Update version.
                lVersion[0] = lNewVersion[0];
                lVersion[1] = lNewVersion[1];
                lVersion[2] = lNewVersion[2];
                break;
        }

        // Update project version.
        pProject.configuration.version = `${lVersion[0]}.${lVersion[1]}.${lVersion[2]}`;
        pProject.save();
    }
}