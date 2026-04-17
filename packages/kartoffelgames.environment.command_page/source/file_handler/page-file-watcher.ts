import { FileSystem } from "@kartoffelgames/environment-core";

export class PageFileWatcher {
    private readonly mListener: Array<PageFileWatcherListener>;
    private readonly mWatchedPaths: Array<string>;
    private mWatcher: Deno.FsWatcher | null;

    /**
     * Constructor.
     * 
     * @param pWatchPaths - Watch paths.
     */
    constructor(pWatchPaths: Array<string>) {
        this.mWatchedPaths = pWatchPaths;
        this.mListener = new Array<PageFileWatcherListener>();
        this.mWatcher = null;
    }

    /**
     * Add a new listener to the watcher.
     * 
     * @param pListener - Listener to add.
     */
    public addListener(pListener: PageFileWatcherListener): void {
        this.mListener.push(pListener);
    }

    /**
     * Initialize watcher for page files.
     * 
     * @param pWatchPaths - Watch paths.
     * @param pWatchCallback - Watch callback.
     */
    public async start(): Promise<void> {
        // Prevent watcher from starting multiple times.
        if (this.mWatcher !== null) {
            return;
        }

        // Init watcher.
        this.mWatcher = Deno.watchFs(this.mWatchedPaths, { recursive: true });

        const lWatchedEvents: Array<string> = ['create', 'modify', 'rename', 'remove'];

        // Skip flag to debounce multiple events for a single change.
        let lDebouncing: boolean = false;

        // Start watcher loop asyncron.
        for await (const lEvent of this.mWatcher) {
            if (lDebouncing) {
                continue;
            }

            // Skip events that doesn't change any files.
            if (!lWatchedEvents.includes(lEvent.kind)) {
                continue;
            }

            // Skip any changes that doesn't have a file extension, as they are likely to be directory changes.
            if(!lEvent.paths.some((p) => FileSystem.pathInformation(p).isFile)) {
                continue;
            }

            // Call all listener
            for (const lListener of this.mListener) {
                lListener();
            }

            // Debounce.
            lDebouncing = true;
            setTimeout(() => {
                lDebouncing = false;
            }, 100);
        }
    }

    /**
     * Stop the watcher.
     */
    public stop(): void {
        // Close watcher if it's running.
        if (this.mWatcher !== null) {
            this.mWatcher.close();
        }

        this.mWatcher = null;
    }
}

export type PageFileWatcherListener = () => void;