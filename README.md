# Kartoffelgames build environment tool

## Init a new project.

`npx @kartoffelgames/environment init kg-main`

## CLI Commands

**Initialize a new project.**  
`kg init <blueprint_name> [project_name] --list`  

**Create new package.**  
`kg create <blueprint_name> [package_name] --list`  

**Build the package.**  
`kg build <package_name> --pack --target --type --scope`  

**Serve scratchpad files over local http server.**  
`kg scratchpad <package_name>`  

**Start page with local http server.**  
`kg page <package_name> --build-only --force`  

**Sync local package versions into all package.json files.**  
`kg sync`  

**Show the command list of all available commands.**  
`kg help`  

**Run all tests of a package.**  
`kg test <package_name> --coverage --no-timeout`  

## Package configuration

`kg.config.blueprint`  
Used blueprint name. Is set automaticly.

`kg.config.page`  
Generates a persistent web page on build. 
This config is required to execute the `kg page` command. 
`true` or `false`

`kg.config.build.target`  
Target platform of package. Possible values are `"web"`, `"application"` or `"module"`

`kg.config.build.pack`  
Package must be build before use. Could be used for web or worker scripts that should be bundled. 
`true` or `false`

`kg.config.build.scope`  
Scope of the package. Where `main` refers to the main thread where worker. Even if packages can have multiple build outputs, each of them must follow the same scope. 
`main` or `worker`