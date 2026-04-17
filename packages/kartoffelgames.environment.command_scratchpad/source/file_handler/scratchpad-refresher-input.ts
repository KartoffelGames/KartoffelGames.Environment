(() => {
    const socket = new WebSocket('ws://127.0.0.1:[[WEBSOCKET_PORT]]');
    socket.addEventListener('open', () => {
        console.log('Refresh connection established');
    });
    socket.addEventListener('message', (event) => {
        console.log('Bundle finished. Start refresh');
        if (event.data === 'REFRESH') {
            window.location.reload();
        }
    });
})();