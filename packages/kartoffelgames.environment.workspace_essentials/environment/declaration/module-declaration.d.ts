declare module '*.css' { 
    /* LOADER::raw-loader */
    const Content: string;
    export default Content;
}

declare module '*.html' {
    /* LOADER::raw-loader */
    const Content: string;
    export default Content;
}

declare module '*.txt' {
    /* LOADER::raw-loader */
    const Content: string;
    export default Content;
}

declare module '*.json' {
    /* LOADER::raw-loader */
    const Content: string;
    export default Content;
}

declare module '*.jsworker' {
    /* LOADER::url-loader{"mimetype": "application/javascript"} */
    const Content: string;
    export default Content;
}

declare module '*.png' {
    /* LOADER::url-loader */
    const Content: string;
    export default Content;
}

declare module '*.jpg' {
    /* LOADER::url-loader */
    const Content: string;
    export default Content;
}

declare module '*.jpeg' {
    /* LOADER::url-loader */
    const Content: string;
    export default Content;
}

declare module '*.gif' {
    /* LOADER::url-loader */
    const Content: string;
    export default Content;
}
