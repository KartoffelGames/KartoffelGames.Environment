// Live-reload client injected into page builds when the build command runs in debug mode.
// The websocket connects back to whatever host and port served the page, so no port needs to be
// configured: the page server upgrades the same origin to a websocket and sends "REFRESH" after a rebuild.
(() => {
    const lProtocol: string = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const lSocket: WebSocket = new WebSocket(`${lProtocol}://${window.location.host}`);

    lSocket.addEventListener('open', () => {
        console.log('Refresh connection established');
    });

    lSocket.addEventListener('message', (pEvent: MessageEvent) => {
        if (pEvent.data === 'REFRESH') {
            console.log('Bundle finished. Start refresh');
            window.location.reload();
        }
    });
})();
