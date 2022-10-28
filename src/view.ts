import {
    ItemFlag,
    Key,
    NodeWidget,
    QDialog,
    QGridLayout,
    QIcon,
    QKeyEvent,
    QMainWindow,
    QPushButton,
    QTabWidget,
    QTextEdit,
    QTreeWidget,
    QTreeWidgetItem,
    QWidget,
    WidgetEventTypes
} from '@nodegui/nodegui';
import {
    ConnectionsSettings, DataProvider,
    LeftTree,
    LeftTreeConnection,
    PanelTools,
    QueryEditor,
    ResultArea,
    StoredConnectionSettings,
    Tab,
    Tabs
} from './app';
import { ObjectID } from 'bson';

const nullIcon = new QIcon('assets/null.png');
const dateIcon = new QIcon('assets/date.png');
const arrayIcon = new QIcon('assets/array.png');
const objectIcon = new QIcon('assets/object.png');
const defaultIcon= new QIcon('assets/default.png');
const stringIcon= new QIcon('assets/string.png');
const numberIcon= new QIcon('assets/number.png');
const objectIdIcon= new QIcon('assets/objectid.png');

const dbIcon = new QIcon('assets/db.png');
const collectionIcon = new QIcon('assets/col.png');
const connectionIcon = new QIcon('assets/con.png');

export const initLayout = (leftTree: NodeWidget<any>, tabs: NodeWidget<any>, panel: NodeWidget<any>, settings: NodeWidget<any>): void => {
    const win = new QMainWindow();
    (global as any).win = win;
    win.setWindowTitle("Bongo");
    win.setWindowIcon(new QIcon('assets/logo.png'));
    win.resize(1200, 600)

    const centralWidget = new QWidget();
    centralWidget.setObjectName("myroot");
    const rootLayout = new QGridLayout();
    centralWidget.setLayout(rootLayout);

    rootLayout.setColumnStretch(1, 2)

   // rootLayout.addWidget(settings);

    win.setCentralWidget(centralWidget);
    win.show();

    rootLayout.addWidget(panel, 0, 0, 1, 2);
    rootLayout.addWidget(leftTree,1,0, 2)
    rootLayout.addWidget(tabs, 1, 1)
}


export class QLeftTree implements LeftTree {
    private readonly tree: QTreeWidget;
    private onSelectHandlers: Array<Function> = [];

    constructor() {
        this.tree = new QTreeWidget();
        this.tree.setHeaderHidden(true);

        this.tree.addEventListener('itemDoubleClicked', () => {
            const selected = this.tree.selectedItems()[0];
            if (!selected.parent() || !selected.parent()?.parent()) {
                return;
            }
            const conName = selected.parent()?.parent()?.text(0);
            const dbName = selected.parent()?.text(0);
            const collName = selected.text(0);
            this.onSelectHandlers.forEach(cb => cb(conName, dbName, collName))
        })
    }

    getWidget(): NodeWidget<any> {
        return this.tree;
    }

    addConnection(con: LeftTreeConnection): void {
        const conTreeItem = new QTreeWidgetItem([con.name]);
        for (const db of con.dbs) {
            const dbTreeItem = new QTreeWidgetItem(conTreeItem, [db.name]);
            dbTreeItem.setIcon(0, dbIcon)
            for (const col of db.collections) {
                const colTreeItem = new QTreeWidgetItem(dbTreeItem, [col.name]);
                colTreeItem.setIcon(0, collectionIcon)
            }
        }
        this.tree.addTopLevelItem(conTreeItem);
        conTreeItem.setIcon(0, connectionIcon)
        conTreeItem.setExpanded(true);
    }

    onSelect(cb: (conName: string, dbName: string, colName: string) => void): void {
        this.onSelectHandlers.push(cb);
    }
}


///

export class QtQueryEditor implements QueryEditor {
    private editor = new QTextEdit()
    private onSubmitHandlers: Array<Function> = [];

    constructor() {
        let cmdPressed = false;
        this.editor.addEventListener(WidgetEventTypes.KeyPress, async (nativeEvent) => {
            const e = new QKeyEvent(nativeEvent!);

            if (!cmdPressed) {
                cmdPressed = e.key() === Key.Key_Control;
            } else if (e.key() === Key.Key_Return) {
                this.runSubmit();
            }
        })

        this.editor.addEventListener(WidgetEventTypes.KeyRelease, nativeEvent => {
            const e = new QKeyEvent(nativeEvent!);
            if (cmdPressed && e.key() === Key.Key_Control) {
                cmdPressed = false;
            }

        })
    }

    getWidget(): NodeWidget<any> {
        return this.editor;
    }


    clear(): void {
        this.editor.clear();
    }

    getQuery(): string {
        return this.editor.toPlainText();
    }

    onSubmit(cb: (code: string) => void): void {
        this.onSubmitHandlers.push(cb);
    }

    setQuery(text: string): void {
        this.editor.setText(text);
    }

    submit(): void {
        this.runSubmit();
    }

    private runSubmit(): void {
        this.onSubmitHandlers.forEach(cb => cb(this.getQuery()));
    }

}

///

export class QResultArea implements ResultArea {
    private tree = new QTreeWidget();
    private index: number = 0;

    constructor() {
        this.tree.setColumnCount(3);
        this.tree.setColumnWidth(0, 300);
        this.tree.setColumnWidth(1, 250);
        this.tree.setHeaderLabels(['Key', 'Value', 'Type']);
    }

    getWidget(): NodeWidget<any> {
        return this.tree;
    }

    addResult(item: any): void {
        const qItem = new QTreeWidgetItem();
        qItem.setIcon(0, objectIcon);
        qItem.setText(0, `(${this.getNextIndex()}) ${item['_id']}`);
        qItem.setText(1, `{ ${Object.keys(item).length} fields }`);
        qItem.setText(2, 'Object');

        const addItem = (item: any, qParent: QTreeWidgetItem) => {
            for (const key in item) {
                const qSubItem = new QTreeWidgetItem(qParent);
                qSubItem.setText(0, key);

                let value: string = '';
                let type: string = '';
                let icon = defaultIcon;

                if (typeof item[key] === 'object') {
                    if (item[key] === null) {
                        type = 'Null';
                        value = 'null'
                        icon = nullIcon;
                    } else if (item[key] instanceof Date) {
                        type = 'Date';
                        value = item[key].toISOString();
                        icon = dateIcon;
                    } else if (Array.isArray(item[key])) {
                        type = 'Array';
                        value = `[ ${item[key].length} elements ]`;
                        icon = arrayIcon;
                        addItem(item[key], qSubItem);
                    } else if (item[key] instanceof ObjectID) {
                        type = 'ObjectId'
                        value = `ObjectId("${item[key].toHexString()}")`
                        icon = objectIdIcon;
                    } else {
                        type = 'Object';
                        value = `{ ${Object.keys(item[key]).length} fields }`;
                        icon = objectIcon;
                        addItem(item[key], qSubItem);
                    }
                } else if (typeof item[key] === 'undefined') {
                    type = 'Undefined';
                    value = 'undefined';
                } else {
                    type = (typeof item[key])[0].toUpperCase() + (typeof item[key]).substr(1);
                    value = item[key].toString();
                    switch (typeof item[key]) {
                        case 'string':
                            icon = stringIcon;
                            break;
                        case 'number':
                            icon = numberIcon;
                    }
                }

                qSubItem.setIcon(0, icon);
                qSubItem.setText(1, value);
                qSubItem.setText(2, type);
            }
        }

        addItem(item, qItem);

        this.tree.addTopLevelItem(qItem)
    }

    clear(): void {
        this.tree.clear();
        this.index = 0;
    }

    private getNextIndex(): number {
        return this.index++;
    }

}
///

export class QTabsSide implements Tabs {
    private tabs = new QTabWidget;

    constructor() {
        this.tabs.setTabsClosable(true);
        this.tabs.addEventListener('tabCloseRequested', index => {
            // todo add confirmation
            this.tabs.removeTab(index);
        })
    }

    newTab(name: string): Tab {
        const editor = new QtQueryEditor();
        const results = new QResultArea();

        const fieldset = new QWidget();
        const fieldsetLayout = new QGridLayout()
        fieldset.setLayout(fieldsetLayout)
        fieldsetLayout.addWidget(editor.getWidget(), 0, 0)
        fieldsetLayout.addWidget(results.getWidget(), 1, 0)
        fieldsetLayout.setRowStretch(1, 3);

        const index = this.tabs.addTab(fieldset, new QIcon(), name)

        this.tabs.setCurrentIndex(index)

        return {
            getResultArea(): ResultArea {
                return results
            },
            getQueryEditor(): QueryEditor {
                return editor
            }
        }
    }

    getWidget(): NodeWidget<any> {
        return this.tabs;
    }
}

///

export class QtConnectionsSettings implements ConnectionsSettings {
    private readonly dialog = new QDialog();
    private table = new QTreeWidget()
    private button = new QPushButton()

    private loadData: () => Array<StoredConnectionSettings> = () => [];
    private saveData: () => void = () => {};
    private connect: (name: string) => void = (_: string) => {};


    constructor() {
        this.dialog.setWindowTitle('Connections');
        this.dialog.setModal(true);
        this.dialog.resize(600, 300);

        this.table.setColumnCount(2);
        this.table.setHeaderLabels(['Name', 'URI']);
        this.table.addEventListener('itemChanged', () => this.saveData());

        const layout = new QGridLayout();

        this.button.addEventListener('clicked', () => {
            const selectedItem = this.table.currentItem();
            if (!selectedItem) {
                return;
            }
            this.connect(selectedItem.text(0));
        })

        layout.addWidget(this.table, 0, 0, 2)
        layout.setRowStretch(0, 4);

        this.button.setText('Connect');
        layout.addWidget(this.button, 2);
        this.dialog.setLayout(layout);

    }

    onConnect(cb: (name: string) => void): void {
        this.connect = cb;
    }

    onLoad(cb: () => Array<StoredConnectionSettings>): void {
        this.loadData = cb;
    }

    onDelete(cb: (id: string) => void): void {
    }

    onSave(cb: (form: Array<StoredConnectionSettings>) => void): void {
        this.saveData = () => {
            const toSave: Array<StoredConnectionSettings> = [];
            this.table.topLevelItems.forEach(item => {
                toSave.push({
                    name: item.text(0),
                    uri: item.text(1)
                })
            })
            cb(toSave);
        };
    }

    onValidate(cb: (form: object) => (object | null)): void {
    }

    open(): void {
        this.table.clear();
        const data = this.loadData();
        let first = true;
        for(const item of data) {
            const qItem = new QTreeWidgetItem()
            qItem.setFlags(qItem.flags() | ItemFlag.ItemIsEditable);
            qItem.setIcon(0, connectionIcon);
            qItem.setText(0, item.name);
            qItem.setText(1, item.uri);
            this.table.addTopLevelItem(qItem);
            if (first) {
                qItem.setSelected(true);
                first = false;
            }
        }

        this.dialog.exec();
    }

    close(): void {
        this.dialog.close();
    }

    getWidget(): NodeWidget<any> {
        return this.dialog;
    }

    setDataProvider(dp: DataProvider<StoredConnectionSettings>): void {
    }
}

///

export class QtPanelTools implements PanelTools {
    //private readonly panel = new QButtonGroup();
    private readonly conSettingsBtn = new QPushButton();
    private readonly handlers: Array<Function> = [];
    constructor() {
        this.conSettingsBtn.setIcon(new QIcon('assets/consbutton.png'))
        this.conSettingsBtn.setFixedSize(50, 50);
        this.conSettingsBtn.addEventListener('clicked', () => {
            this.handlers.forEach(cb => cb());
        })

        //this.panel.addButton(this.conSettingsBtn, 1);
    }
    onConnectionsSettingsOpen(cb: Function): void {
        this.handlers.push(cb);
    }


    getWidget(): NodeWidget<any> {
        return this.conSettingsBtn;
    }
}
