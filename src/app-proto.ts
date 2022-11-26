import {FindCursor, MongoClient} from "mongodb";
import {ConnectionsSettings, LeftTree, LeftTreeConnection, PanelTools, StoredConnectionSettings, Tabs} from "./app";

// draft of the new app.ts
class App {
    private cons = new Map<string, MongoClient>();
    private storedConnections = [
        {
            name: 'Localhost',
            uri: 'mongodb://localhost:27017/'
        }
    ];

    constructor(private leftTree: LeftTree,
                private tabs: Tabs,
                private panel: PanelTools,
                private conSettings: ConnectionsSettings,) {
    }

    init() {
        this.leftTree.onSelect(this.collectionSelected.bind(this));
        this.panel.onConnectionsSettingsOpen(() => {
            this.conSettings.open();
        });

        this.conSettings.onValidate((_: object) => {
            return null
        })

        this.conSettings.setDataProvider({
            load: (): Array<StoredConnectionSettings> => {
                return this.storedConnections;
            },
            save: (data: Array<StoredConnectionSettings>): void => {
                this.storedConnections = data;
            },
            delete: (id: string): void => {
                this.storedConnections = this.storedConnections.filter(x => x.name !== id);
            }
        });

        this.conSettings.onConnect((name: string) => {
            this.createNewConnection(name).catch(console.error);
            this.conSettings.close();
        })
    }

    private async createNewConnection(name: string) {
        const conSettings = this.storedConnections.find(x => x.name === name);
        if (!conSettings) {
            throw new Error('connection not found');
        }

        const client = new MongoClient(conSettings.uri);
        await client.connect();
        this.cons.set(name, client);
        const dbs = await client.db().admin().listDatabases();
        const leftTreeCon: LeftTreeConnection = {
            name,
            dbs: []
        };
        for (const dbItem of dbs.databases) {
            leftTreeCon.dbs.push({
                name: dbItem.name,
                collections: await client.db(dbItem.name).collections()
                    .then((cols: any[]) => cols.map(x => ({name: x.collectionName})))
            });
        }
        this.leftTree.addConnection(leftTreeCon)
    }

    collectionSelected(conName: string, dbName: string, colName: string) {
        const newTab = this.tabs.newTab(colName);
        newTab.getQueryEditor().setQuery(`db.collection('${colName}').find({})`);
        newTab.getQueryEditor().onSubmit(async (code: string) => {
            const connection = this.cons.get(conName)!; // this const is supposed to be available inside eval
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
    }
}