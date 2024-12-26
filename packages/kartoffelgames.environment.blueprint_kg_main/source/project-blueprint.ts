import { ICliProjectBlueprintResolver } from '@kartoffelgames/environment.core';

export class CliProjectBlueprint implements ICliProjectBlueprintResolver {
    /**
     * Needs nothing.
     */
    public async afterCopy(): Promise<void> {
        // Needs nothing.
    }
}