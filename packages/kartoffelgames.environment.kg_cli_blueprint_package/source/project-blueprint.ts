import { KgCliBlueprintDescription } from '@kartoffelgames/environment.kg-cli-command-create/library/source/interfaces/i-kg-cli-package-blueprint';
import { IKgCliProjectBlueprint } from '@kartoffelgames/environment.kg-cli-command-init';
import * as path from 'path';

export class KgCliProjectBlueprint implements IKgCliProjectBlueprint {
    /**
     * Package information.
     */
    public get information(): KgCliBlueprintDescription {
        return {
            name: 'kg-main',
            blueprintDirectory: path.resolve(__dirname, '..', '..', 'project_blueprint'), // called from library/source
            description: 'Default kartoffelgames project'
        };
    }

    /**
     * Replace placeholder in files.
     */
    public async afterCopy(): Promise<void> {
        // Needs nothing.
    }
}