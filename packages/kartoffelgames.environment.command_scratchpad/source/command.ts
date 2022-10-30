import { CliParameter, IKgCliCommand, KgCliCommandDescription } from '@kartoffelgames/environment.cli';
import { Project } from '@kartoffelgames/environment.core';

export class KgCliCommand implements IKgCliCommand {
    /**
     * Command description.
     */
    public get information(): KgCliCommandDescription {
        return {
            command: {
                description: 'Serve scratchpad files over local http server.',
                pattern: 'scratchpad'
            }
        };
    }

    /**
     * Execute command.
     * @param _pParameter - Command parameter.
     * @param _pCliPackages - All cli packages grouped by type.
     */
    public async run(_pParameter: CliParameter, _pCliPackages: Array<string>, pProjectHandler: Project): Promise<void> {
       
    }

}