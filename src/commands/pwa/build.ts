import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson, JsonMap } from '@salesforce/ts-types';

import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

import { Settings } from '../../types/settings';
import { getPluginConfig, mergeConfigDefaults } from '../../util/config';
import { composeStaticResourceUrl } from '../../util/sfdc';
import {
  PLUGIN_NAMESPACE,
  SFDC_DEPLOY_TOKEN,
  SFDC_PAGE_META_CONTENT,
  SFDC_RESOURCE_META_CONTENT,
  VF_TEMPLATE_CONTENT,
  VF_TEMPLATE_FILENAME
} from '../../util/tokens';
import * as vfTransform from '../../util/visualforceTransform';

interface BuildFlags {
  apiversion: string;
  packagemanager: string;
  buildcmd: string;
  framework: string;
  pwapath: string;
  ngproject: string;
  sfdcpath: string;
  sfdcpage: string;
  sfdcresource: string;
}

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-pwa-plugin', 'pwa');

export default class Build extends SfdxCommand {
  public static description = messages.getMessage('buildCommandDescription');

  public static examples = [
    `# Uses initialized plugin settings
$ sfdx pwa:build

    === Building PWA for SFDC
    ...
    Building PWA... Done

    PWA built and packed for SFDC deployment!

  `,
    `# Flag overrides take precedence over plugin settings
# After plugin will finish execution you will be offered to update plugin settings
$ sfdx pwa:build
  -b build:sfdc (--buildcmd=build:commandname)
  -m yarn (--packagemanager=(npm|yarn|pnpm))
  -p client (--ngpath=relative/path/to/angular-app)
  -t forceApp/main/ngApp (--sfdcpath=relative/path/to/sfdc-folder)
  --apiversion 42.0
  --ngproject ng-app-name
  --sfdcpage PageName
  --sfdcresource StaticResourceName
  `
  ];

  protected static flagsConfig = {
    buildcmd: flags.string({
      char: 'b',
      description: messages.getMessage('buildcmdFlagDescription')
    }),
    packagemanager: flags.enum({
      char: 'm',
      description: messages.getMessage('packageManagerFlagDescription'),
      options: ['npm', 'yarn', 'pnpm']
    }),
    apiversion: flags.builtin({
      description: messages.getMessage('apiversionFlagDescription')
    }),
    framework: flags.enum({
      char: 'f',
      description: messages.getMessage('frameworkFlagDescription'),
      options: ['react', 'ng']
    }),
    pwapath: flags.directory({
      char: 'p',
      description: messages.getMessage('pwaPathFlagDescription')
    }),
    ngproject: flags.directory({
      description: messages.getMessage('ngProjectFlagDescription')
    }),
    sfdcpath: flags.directory({
      char: 't',
      description: messages.getMessage('sfdcPathFlagDescription')
    }),
    sfdcpage: flags.string({
      description: messages.getMessage('sfdcPageFlagDescription')
    }),
    sfdcresource: flags.string({
      description: messages.getMessage('sfdcResourceFlagDescription')
    })
  };

  protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    const projectPath = await this.project.getPath();
    const projectConfig = await this.project.retrieveSfdxProjectJson();
    const pluginSettings: Settings = this.overrideConfig(
      await mergeConfigDefaults(projectConfig.getContents()),
      this.flags as BuildFlags
    );

    this.ux.styledHeader('Building PWA for SFDC');

    if (pluginSettings.framework === 'angular') {
      const buildExitCode = await this.buildAngularProject(projectPath, pluginSettings);
      if (buildExitCode) {
        throw new SfdxError(messages.getMessage('errorBuildFailed'));
      }
    } else {
      const buildExitCode = await this.buildReactProject(projectPath, pluginSettings);
      if (buildExitCode) {
        throw new SfdxError(messages.getMessage('errorBuildFailed'));
      }

      const reactIndexHtml = path.join(projectPath, pluginSettings.pwaPath, 'build', 'index.html');
      const html = await fs.readFile(reactIndexHtml, 'utf8');
      await fs.writeFile(
        reactIndexHtml,
        html.split('/static/').join(SFDC_DEPLOY_TOKEN + 'static/')
      );
      await vfTransform.updateLoadedReactScriptsPath(
        path.join(projectPath, pluginSettings.pwaPath, 'build')
      );
    }

    await this.buildSfdcSources(projectPath, pluginSettings);

    // Return an object to be displayed with --json
    const statusMessage = 'PWA built and packed for SFDC deployment!';
    this.ux.log(`\n${statusMessage}`);

    if (this.hasOverrides(getPluginConfig(projectConfig.getContents()), this.flags as BuildFlags)) {
      if (
        await this.ux.confirm(
          '\nDo you want to update plugin settings with new configuration? (y/n)'
        )
      ) {
        projectConfig.set(`plugins.${PLUGIN_NAMESPACE}`, (pluginSettings as unknown) as JsonMap);
        await projectConfig.write(projectConfig.getContents());
      }
    }

    // Return an object to be displayed with --json
    return {
      success: true,
      message: statusMessage
    };
  }

  private checkAngularProject(ngDirPath: string): void {
    if (!fs.existsSync(ngDirPath)) {
      throw new SfdxError(messages.getMessage('errorUnresolvableDir', [ngDirPath]));
    }

    const angularJsonPath = path.resolve(ngDirPath, 'angular.json');
    const isAngularProject = fs.existsSync(angularJsonPath);
    if (!isAngularProject) {
      throw new SfdxError(messages.getMessage('errorUnresolvableAngularProject', [ngDirPath]));
    }
  }

  private async buildAngularProject(rootPath: string, settings: Settings): Promise<number> {
    const ngDirPath = path.join(rootPath, settings.pwaPath);
    this.checkAngularProject(ngDirPath);

    const buildCommands = ['run', settings.buildScriptName];
    if (settings.packageManager !== 'yarn') {
      buildCommands.push('--');
    }
    buildCommands.push(`--deployUrl=${SFDC_DEPLOY_TOKEN}`);

    const buildProcess = child_process.spawn(settings.packageManager, buildCommands, {
      cwd: ngDirPath,
      stdio: 'inherit'
    });
    return new Promise<number>((resolve, reject) => {
      buildProcess.on('close', resolve);
    });
  }

  private async buildReactProject(rootPath: string, settings: Settings): Promise<number> {
    const pwaDirPath = path.join(rootPath, settings.pwaPath);

    const buildCommands = ['run', settings.buildScriptName];
    if (settings.packageManager !== 'yarn') {
      buildCommands.push('--');
    }

    const buildProcess = child_process.spawn(settings.packageManager, buildCommands, {
      cwd: pwaDirPath,
      stdio: 'inherit'
    });

    return new Promise<number>((resolve, reject) => {
      buildProcess.on('close', resolve);
    });
  }

  private async buildSfdcSources(projectPath: string, pluginSettings: Settings) {
    const pwaDirPath = path.resolve(projectPath, pluginSettings.pwaPath);
    const pwaDistPath =
      pluginSettings.framework === 'ng'
        ? path.resolve(pwaDirPath, 'dist', pluginSettings.pwaProject)
        : path.resolve(pwaDirPath, 'build');

    const sfdcDirPath = path.resolve(projectPath, pluginSettings.sfdcPath);
    const staticResourcePath = path.join(
      sfdcDirPath,
      'staticresources',
      pluginSettings.sfdcResourceName
    );
    const vfPagePath = path.join(sfdcDirPath, 'pages', pluginSettings.sfdcVfPageName);

    this.ux.startSpinner('Building PWA');

    this.ux.setSpinnerStatus('Preparing folders');
    await fs.ensureDir(sfdcDirPath);
    await fs.ensureDir(path.join(sfdcDirPath, 'pages'));
    await fs.remove(staticResourcePath);
    await fs.ensureDir(staticResourcePath);

    this.ux.setSpinnerStatus('Updating lazy scripts runtime path');
    await vfTransform.updateLoadedScriptsPath(pwaDistPath);

    this.ux.setSpinnerStatus('Moving PWA dist');
    await fs.copy(pwaDistPath, staticResourcePath);
    await fs.writeFile(`${staticResourcePath}.resource-meta.xml`, SFDC_RESOURCE_META_CONTENT);

    this.ux.setSpinnerStatus('Preparing Visualforce Page');

    const vfTemplatePath = path.join(projectPath, VF_TEMPLATE_FILENAME);
    const vfTemplate = await this.getVfTemplate(vfTemplatePath);
    await this.transformVfPage(
      path.join(staticResourcePath, 'index.html'),
      vfTemplate,
      pluginSettings.sfdcResourceName
    );

    await fs.move(path.join(staticResourcePath, 'index.html'), path.resolve(`${vfPagePath}.page`), {
      overwrite: true
    });
    await fs.writeFile(
      `${vfPagePath}.page-meta.xml`,
      SFDC_PAGE_META_CONTENT(pluginSettings.sfdcApiVersion, pluginSettings.sfdcVfPageName)
    );

    this.ux.stopSpinner('Done');
  }

  private async transformVfPage(
    vfPagePath: string,
    vfTemplate: string,
    staticResourceName: string
  ): Promise<void> {
    let vfPage: string;
    const staticResourceUrl = composeStaticResourceUrl(staticResourceName);
    const html = await fs.readFile(vfPagePath, 'utf8');

    if (!vfTransform.checkBuildValidity(html)) {
      throw new SfdxError(messages.getMessage('errorVfTransformFailed'));
    }

    this.ux.setSpinnerStatus('Transforming html to Visualforce');
    vfPage = vfTransform.wrapIntoVfPage(html, vfTemplate);
    this.ux.setSpinnerStatus('Sanitizing tags');
    vfPage = vfTransform.sanitizeTags(vfPage);
    this.ux.setSpinnerStatus('Setting SFDC resouces url');
    vfPage = vfTransform.updateDeployUrl(vfPage, staticResourceUrl);
    this.ux.setSpinnerStatus('Setting ES5 fallback script initializer');
    vfPage = vfTransform.createLegacyScriptsInitializer(vfPage);

    return fs.writeFile(vfPagePath, vfPage);
  }

  private async getVfTemplate(templatePath: string): Promise<string> {
    if (fs.existsSync(templatePath)) {
      return await fs.readFile(templatePath, 'utf8');
    }
    return VF_TEMPLATE_CONTENT;
  }

  private hasOverrides(settings: Settings, processFlags: BuildFlags): boolean {
    return (
      !settings ||
      !Object.keys(settings).length ||
      (processFlags.buildcmd && processFlags.buildcmd !== settings.buildScriptName) ||
      (processFlags.packagemanager && processFlags.packagemanager !== settings.packageManager) ||
      (processFlags.apiversion && processFlags.apiversion !== settings.sfdcApiVersion) ||
      (processFlags.framework && processFlags.framework !== settings.framework) ||
      (processFlags.pwapath && processFlags.pwapath !== settings.pwaPath) ||
      (processFlags.ngproject && processFlags.ngproject !== settings.pwaProject) ||
      (processFlags.sfdcpath && processFlags.sfdcpath !== settings.sfdcPath) ||
      (processFlags.sfdcpage && processFlags.sfdcpage !== settings.sfdcVfPageName) ||
      (processFlags.sfdcresource && processFlags.sfdcresource !== settings.sfdcResourceName)
    );
  }

  private overrideConfig(settings: Settings, processFlags: BuildFlags): Settings {
    if (processFlags.buildcmd) {
      settings.buildScriptName = processFlags.buildcmd;
    }
    if (processFlags.packagemanager) {
      settings.packageManager = processFlags.packagemanager;
    }
    if (processFlags.apiversion) {
      settings.sfdcApiVersion = processFlags.apiversion;
    }
    if (processFlags.pwapath) {
      settings.pwaPath = processFlags.pwapath;
    }
    if (processFlags.ngproject) {
      settings.pwaProject = processFlags.ngproject;
    }
    if (processFlags.sfdcpath) {
      settings.sfdcPath = processFlags.sfdcpath;
    }
    if (processFlags.sfdcpage) {
      settings.sfdcVfPageName = processFlags.sfdcpage;
    }
    if (processFlags.sfdcresource) {
      settings.sfdcResourceName = processFlags.sfdcresource;
    }

    return settings;
  }
}
