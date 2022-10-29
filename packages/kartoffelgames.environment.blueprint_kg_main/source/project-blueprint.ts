import { KgCliBlueprintDescription } from '@kartoffelgames/environment.kg-cli-command-create/kartoffelgames.environment.command_create/source/interfaces/i-kg-cli-package-blueprint';
import { IKgCliProjectBlueprint } from '@kartoffelgames/environment.kg-cli-command-init/kartoffelgames.environment.command_init/source';
import * as path from 'path';

export class KgCliProjectBlueprint implements IKgCliProjectBlueprint {
    /**
     * Package information.
     */
    public get information(): KgCliBlueprintDescription {
        return {
            name: 'kg-main',
            blueprintDirectory: path.resolve(__dirname, '..', '..', 'project_blueprint'), // called from library/source
            description: 'Default KartoffelGames project'
        };
    }

    /**
     * Needs nothing.
     */
    public async afterCopy(): Promise<void> {
        // Needs nothing.
    }
}