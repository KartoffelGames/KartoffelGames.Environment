module.exports = (()=>{
    const lTestContext = (<any>require).context('.', true, /.test.ts$/);
    lTestContext.keys().forEach(lTestContext);

    const lComponentContext = (<any>require).context('../source', true, /.ts$/);
    lComponentContext.keys().forEach(lComponentContext);

    return lTestContext;
})();