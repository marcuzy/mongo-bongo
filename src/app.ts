import { FindCursor, MongoClient } from 'mongodb';

export const startApp = async (
    leftTree: LeftTree,
    tabs: Tabs,
    panel: PanelTools,
    conSettings: ConnectionsSettings,
) => {
    let storedConnections = [
        {
            name: 'Localhost',
            uri: 'mongodb://localhost:27017/'
        }
    ];
    const cons = new Map<string, MongoClient>();

    const createNewConnection = async (name: string) => {
        const conSettings = storedConnections.find(x => x.name === name);
        if (!conSettings) {
            throw new Error('connection not found');
        }

        const client = new MongoClient(conSettings.uri);
        await client.connect();
        cons.set(name, client);
        const dbs = await client.db().admin().listDatabases();
        const leftTreeCon: LeftTreeConnection = {
            name,
            dbs: []
        };
        for (const dbItem of dbs.databases) {
            leftTreeCon.dbs.push({
                name: dbItem.name,
                collections: await client.db(dbItem.name).collections()
                    .then(cols => cols.map(x => ({name: x.collectionName})))
            });
        }
        leftTree.addConnection(leftTreeCon)
    }

    leftTree.onSelect((conName: string, dbName: string, colName: string) => {
        const newTab = tabs.newTab(colName);
        newTab.getQueryEditor().setQuery(`db.collection('${colName}').find({})`);
        newTab.getQueryEditor().onSubmit(async (code: string) => {
            const connection = cons.get(conName)!; // this const is supposed to be available inside eval
            const db = connection.db(dbName); // this const is supposed to be available inside eval
            const evalRes = eval(code);
            let res: FindCursor;
            if (evalRes instanceof Promise) {
                res = await evalRes;
            } else {
                res = evalRes;
            }

            const arrRes = await res.toArray();
            newTab.getResultArea().clear();
            for (const doc of arrRes) {
                newTab.getResultArea().addResult(doc);
            }
        })
        newTab.getQueryEditor().submit();
    });

    panel.onConnectionsSettingsOpen(() => {
        conSettings.open();
    });

    conSettings.onValidate((_: object) => {
        return null
    })

    conSettings.setDataProvider({
        load: (): Array<StoredConnectionSettings> => {
            console.log('storedConnections', storedConnections)
            return storedConnections;
        },
        save: (data: Array<StoredConnectionSettings>): void => {
            storedConnections = data;
        },
        delete: (id: string): void => {
            storedConnections = storedConnections.filter(x => x.name !== id);
        }
    });

    conSettings.onConnect((name: string) => {
        createNewConnection(name).catch(console.error);
        conSettings.close();
    })
}

export interface LeftTreeConnection {
    name: string;
    dbs: Array<{
        name: string;
        collections: Array<{ name: string; }>
    }>
}

export interface LeftTree {
    addConnection(con: LeftTreeConnection): void
    onSelect(cb: (conName: string, dbName: string, colName: string) => void): void
}

export interface QueryEditor {
    setQuery(text: string): void
    getQuery(): string;
    clear(): void;
    submit(): void;
    onSubmit(cb: (code: string) => void): void
}

export interface ResultArea {
    addResult(doc: object): void
    clear(): void;
}

export interface Tab {
    getQueryEditor(): QueryEditor
    getResultArea(): ResultArea
}

export interface Tabs {
    newTab(name: string): Tab
}

export interface PanelTools {
    onConnectionsSettingsOpen(cb: Function): void
}

export interface ConnectionsSettings {
    open(): void;
    close(): void;
    setDataProvider(dp: DataProvider<StoredConnectionSettings>): void
    onValidate(cb: (form: object) => object | null): void;
    onConnect(cb: (name: string) => void): void;
}

export interface DataProvider<T> {
    load: () => Array<T>;
    save: (data: Array<T>) => void;
    delete: (id: string) => void;
}

export interface StoredConnectionSettings {
    name: string;
    uri: string;
}
