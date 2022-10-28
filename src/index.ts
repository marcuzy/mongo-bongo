import { initLayout, QLeftTree, QTabsSide, QtConnectionsSettings, QtPanelTools } from './view';
import { startApp } from './app';

const leftTree = new QLeftTree();
const tabs = new QTabsSide;
const panel = new QtPanelTools
const settings = new QtConnectionsSettings()

initLayout(leftTree.getWidget(), tabs.getWidget(), panel.getWidget(), settings.getWidget());
startApp(leftTree, tabs, panel, settings).catch(console.error);

