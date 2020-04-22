import { JsonMap } from '@salesforce/ts-types';
import { Settings } from '../types/settings';
import { PLUGIN_NAMESPACE } from './tokens';

export const DEFAULT_SFDC_DIR = 'force-app/main/default';
export const DEFAULT_SFDC_VFPAGE_NAME = 'pwaSfdc';

export const getPluginConfig = (projectSettings: JsonMap): Settings =>
  (projectSettings.plugins && { ...projectSettings.plugins[PLUGIN_NAMESPACE] }) || {};

export const mergeConfigDefaults = (projectSettings: JsonMap): Settings => {
  const settings: Settings = getPluginConfig(projectSettings);

  settings.packageManager = settings.packageManager || 'npm';
  settings.buildScriptName = settings.buildScriptName || 'build';
  settings.sfdcApiVersion = settings.sfdcApiVersion || (projectSettings.sourceApiVersion as string);

  settings.sfdcPath = settings.sfdcPath || DEFAULT_SFDC_DIR;
  settings.sfdcVfPageName = settings.sfdcVfPageName || DEFAULT_SFDC_VFPAGE_NAME;
  settings.sfdcResourceName = settings.sfdcResourceName;

  return settings;
};
