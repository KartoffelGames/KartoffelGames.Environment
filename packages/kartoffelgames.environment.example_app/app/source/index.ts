// Entry point of the example app. It is bundled by `kg build` / `kg app` into ./app/bundle/app.js and loaded by
// ./app/index.html. It is deliberately framework-free and self-contained (no imports): a small, typed, interactive
// UI built straight from the DOM API, so the same bundle runs identically when served by `kg app` and when embedded
// into a native binary by the desktop build.

/**
 * A tiny helper to create an element with attributes, text and children in one call.
 */
const el = <K extends keyof HTMLElementTagNameMap>(
    pTag: K,
    pProperties: Partial<Record<string, string>> = {},
    pChildren: Array<Node | string> = []
): HTMLElementTagNameMap[K] => {
    const lElement = document.createElement(pTag);

    for (const [lKey, lValue] of Object.entries(pProperties)) {
        if (lValue !== undefined) {
            lElement.setAttribute(lKey, lValue);
        }
    }

    for (const lChild of pChildren) {
        lElement.append(lChild);
    }

    return lElement;
};

/**
 * Render the whole example UI into the given mount element.
 */
const render = (pMount: HTMLElement): void => {
    // ---- State -------------------------------------------------------------------------------------------------
    let lCount: number = 0;

    // ---- Header ------------------------------------------------------------------------------------------------
    const lTitle = el('h1', { class: 'title' }, ['KartoffelGames Example App']);
    const lSubtitle = el('p', { class: 'subtitle' }, ['Live-reloading dev page & native desktop target']);

    const lThemeButton = el('button', { type: 'button' }, ['☀ Light']);
    lThemeButton.addEventListener('click', () => {
        const lNext: string = pMount.dataset['theme'] === 'light' ? 'dark' : 'light';
        pMount.dataset['theme'] = lNext;
        lThemeButton.textContent = lNext === 'light' ? '☾ Dark' : '☀ Light';
    });

    const lHeader = el('header', { class: 'header' }, [
        el('div', {}, [lTitle, lSubtitle]),
        lThemeButton
    ]);

    // ---- Counter card ------------------------------------------------------------------------------------------
    const lCountValue = el('div', { class: 'count-value' }, [String(lCount)]);
    const lRenderCount = (): void => {
        lCountValue.textContent = String(lCount);
    };

    const lDecrementButton = el('button', { type: 'button', 'aria-label': 'decrement' }, ['−']);
    lDecrementButton.addEventListener('click', () => {
        lCount--;
        lRenderCount();
    });

    const lIncrementButton = el('button', { type: 'button', class: 'accent', 'aria-label': 'increment' }, ['+']);
    lIncrementButton.addEventListener('click', () => {
        lCount++;
        lRenderCount();
    });

    const lResetButton = el('button', { type: 'button' }, ['Reset']);
    lResetButton.addEventListener('click', () => {
        lCount = 0;
        lRenderCount();
    });

    const lCounterCard = el('section', { class: 'card' }, [
        el('div', { class: 'card-label' }, ['Interactive counter']),
        el('div', { class: 'counter' }, [
            lCountValue,
            el('div', { class: 'button-row' }, [lDecrementButton, lResetButton, lIncrementButton])
        ])
    ]);

    // ---- Accent colour card ------------------------------------------------------------------------------------
    const lColorInput = el('input', { type: 'color', value: '#e8a33d' });
    lColorInput.addEventListener('input', () => {
        document.documentElement.style.setProperty('--accent', lColorInput.value);
    });

    const lColorCard = el('section', { class: 'card' }, [
        el('div', { class: 'card-label' }, ['Accent colour']),
        el('div', { class: 'row' }, [
            el('span', {}, ['Pick an accent - it updates the CSS variable live']),
            lColorInput
        ])
    ]);

    // ---- Clock + environment card ------------------------------------------------------------------------------
    const lClock = el('div', { class: 'clock' }, ['--:--:--']);
    globalThis.setInterval(() => {
        lClock.textContent = new Date().toLocaleTimeString();
    }, 1000);
    lClock.textContent = new Date().toLocaleTimeString();

    // SharedArrayBuffer is only available when the page is cross-origin isolated (COOP/COEP headers). Both the
    // `app` dev server and the generated desktop server send those headers, so this dot should be green in both.
    const lIsolated: boolean = typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true;
    const lIsolationDot = el('span', { class: `dot ${lIsolated ? 'good' : 'bad'}` }, []);
    const lIsolationBadge = el('span', { class: 'badge' }, [
        lIsolationDot,
        lIsolated ? 'crossOriginIsolated (SharedArrayBuffer ready)' : 'not cross-origin isolated'
    ]);

    const lStatusCard = el('section', { class: 'card' }, [
        el('div', { class: 'card-label' }, ['Runtime']),
        el('div', { class: 'row' }, [el('span', {}, ['Local time']), lClock]),
        el('div', { class: 'row', style: 'margin-top:12px' }, [el('span', {}, ['Isolation']), lIsolationBadge])
    ]);

    // ---- Footer ------------------------------------------------------------------------------------------------
    const lFooter = el('footer', { class: 'footer' }, [
        'Edit app/source/index.ts and save — the page live-reloads while running `kg app`.'
    ]);

    // ---- Mount -------------------------------------------------------------------------------------------------
    pMount.replaceChildren(lHeader, lCounterCard, lColorCard, lStatusCard, lFooter);
};

// Boot once the DOM is ready.
const lMount: HTMLElement | null = document.getElementById('app');
if (lMount !== null) {
    render(lMount);
}
