import type {
    EnvironmentBundleOptions
} from '@kartoffelgames/environment-bundle';

export default () => {
    return {
        loader: {
            '.css': 'text',
            '.html': 'text',
            '.png': 'dataurl',
            '.jpeg': 'dataurl',
            '.jpg': 'dataurl',
            '.jsworker': 'dataurl'
        },
        files: [
            {
                inputFilePath: './source/index.ts',
                outputBasename: '<packagename>',
                outputExtension: 'jsworker'
            }
        ]
    } satisfies Partial<EnvironmentBundleOptions>;
}

