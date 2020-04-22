# sfdx-pwa-plugin

SFDX plugin for PWA (React & Angular apps) deployment on Salesforce

[![Version](https://img.shields.io/npm/v/sfdx-pwa-plugin.svg)](https://npmjs.org/package/sfdx-pwa-plugin)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-pwa-plugin.svg)](https://npmjs.org/package/sfdx-pwa-plugin)
[![License](https://img.shields.io/npm/l/sfdx-pwa-plugin.svg)](https://github.com/rzhigalov/sfdx-pwa-plugin/blob/master/package.json)

<div style="padding: 10px;background: rgba(227, 98, 9, 0.5);">
  <div>⚠️ This package is yet in <b>beta</b> version and may not work in <i>all</i> cases.</div>
  <div>Please, create an <a href="https://github.com/rzhigalov/sfdx-pwa-plugin/issues/new" target="_blank">issue</a> if you encountered any issues</div>
</div>
<!-- install -->

### Prerequesites

1. [SFDX](https://developer.salesforce.com/tools/sfdxcli)
2. For Angular Projects: [Angular CLI](https://cli.angular.io/)

## Installation

### Install as plugin

`sfdx plugins:install sfdx-pwa-plugin`

### Install from source

1. Clone repository  
   `git@github.com:rzhigalov/sfdx-pwa-plugin.git`
2. Open cloned folder  
   `cd path/to/cloned/repo`
3. Install npm modules  
   `npm install` or `yarn install`
4. Link the plugin  
   `sfdx plugins:link .`

## Usage

### General flow

1. [Setup SFDX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_create_new.htm)
   e.g. `sfdx force:project:create -n ProjectName --template standard`)
2. Create scratch org or configure persistent instance
3. Initialize PWA

   1. Angular — `ng new my-shiny-metal-project`

   ```javascript
   /**
    * If you use routing in Angular app, than configure it to use URL fragment strategy
    * This is required as you can't override Salesforce routing resolution
    */

   RouterModule.forRoot(ROUTES, {
     useHash: true
   });
   ```

   2. React – `npx create-react-app my-pwa`

4. Run `sfdx pwa:init` and follow the prompts
5. (_optional_) Configure `vf.template.page` with controller and Visualforce page appearance
6. Run `sfdx pwa:build`
7. Deploy code to Salesforce (`sfdx force:source:deploy` or `sfdx force:source:push`)

---

### Commands

#### sfdx pwa:init`

Initializes files and settings for plugin

```bash
USAGE
  $ sfdx pwa:init [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx pwa:init
    Starts plugin configuration wizard
```

#### `sfdx pwa:build`

Builds and packs PWA for SFDC deployment

```shell
USAGE
  $ sfdx pwa:build [-b <string>] [-m npm|yarn|pnpm] [-p <directory>] [--ngproject <directory>] [-t <directory>] [--sfdcpage <string>] [--sfdcresource <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --buildcmd=buildcmd                                                           Angular build command
  -m, --packagemanager=(npm|yarn|pnpm)                                              Used package manager (npm, yarn, pnpm)
  -p, --ngpath=ngpath                                                               Relative path to PWA (folder with PWA\'s package.json)
  -t, --sfdcpath=sfdcpath                                                           Relative path to SFDC target dir
  --apiversion=apiversion                                                           SFDC API version
  --ngproject=ngproject                                                             Specific to Angular projects: Angular Project name
  --sfdcpage=sfdcpage                                                               SFDC Static Visualforce page name
  --sfdcresource=sfdcresource                                                       SFDC Static Resource name
  --json                                                                            format output as json
  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLES
  # Uses initialized plugin settings
  $ sfdx pwa:build

       === Building PWA for SFDC
       ...
       Creating PWA SFDC application... Done

       PWA built and packed for SFDC deployment!


  # Flag overrides take precedence over plugin settings
  # After plugin will finish execution you will be offered to update plugin settings
  $ sfdx pwa:build
     -b build:sfdc (--buildcmd=build:commandname)
     -m yarn (--packagemanager=(npm|yarn|pnpm))
     -p client (--ngpath=relative/path/to/pwa-folder)
     -t forceApp/main/ngApp (--sfdcpath=relative/path/to/sfdc-folder)
     --apiversion 42.0
     --ngproject ng-app-name
     --sfdcpage PageName
     --sfdcresource StaticResourceName
```
