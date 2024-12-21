import { IKgCliProjectBlueprint, KgCliProjectBlueprintDescription } from '@kartoffelgames/environment.command-init';
import * as path from 'path';

export class KgCliProjectBlueprint implements IKgCliProjectBlueprint {
    /**
     * Package information.
     */
    public get information(): KgCliProjectBlueprintDescription {
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