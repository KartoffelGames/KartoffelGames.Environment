import type {
    EnvironmentBundleOptions
} from '@kartoffelgames/environment-bundle';

export default {
    loader: {
        '.css': 'text',
        '.html': 'text',
        '.png': 'dataurl',
        '.jpeg': 'dataurl',
        '.jpg': 'dataurl'
    }
} satisfies Partial<EnvironmentBundleOptions>;

