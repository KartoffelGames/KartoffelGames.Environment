export class ScratchpadFileWatcher {
    private readonly mListener: Array<ScratchpadFileWatcherListener>;
    private readonly mWatchedPaths: Array<string>;
    private mWatcher: Deno.FsWatcher | null;

    /**
     * Constructor.
     * 
     * @param pWatchPaths - Watch paths.
     */
    constructor(pWatchPaths: Array<string>) {
        this.mWatchedPaths = pWatchPaths;
        this.mListener = new Array<ScratchpadFileWatcherListener>();
        this.mWatcher = null;
    }

    /**
     * Add a new listener to the watcher.
     * 
     * @param pListener - Listener to add.
     */
    public addListener(pListener: ScratchpadFileWatcherListener): void {
        this.mListener.push(pListener);
    }

    /**
     * Initialize watcher for scratchpad files.
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

        // Init debounce timer.
        let lDebounceTimer: number = 0;

        const lWatchedEvents: Array<string> = ['create', 'modify', 'rename', 'remove'];

        // Start watcher loop asyncron.
        for await (const lEvent of this.mWatcher) {
            // Skip events that doesn't change any files.
            if (!lWatchedEvents.includes(lEvent.kind)) {
                return;
            }

            // Reset debounce timer.
            clearTimeout(lDebounceTimer);

            // Set new debounce timer.
            lDebounceTimer = setTimeout(() => {
                // Call all listener
                for (const lListener of this.mListener) {
                    lListener();
                }
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

export type ScratchpadFileWatcherListener = () => void;