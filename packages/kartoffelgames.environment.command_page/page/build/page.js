console.log("Hello World!!!");(()=>{let e=new WebSocket("ws://127.0.0.1:8088");e.addEventListener("open",()=>{console.log("Refresh connection established")}),e.addEventListener("message",o=>{console.log("Bundle finished. Start refresh"),o.data==="REFRESH"&&window.location.reload()})})();
//# sourceMappingURL=page.js.map
