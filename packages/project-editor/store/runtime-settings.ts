import fs from "fs";
import { makeObservable, observable, toJS, runInAction } from "mobx";

import * as notification from "eez-studio-ui/notification";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { IObjectVariableValue } from "project-editor/features/variable/value-type";
import { IVariable } from "project-editor/flow/flow-interfaces";
import type { DocumentStoreClass } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export class RuntimeSettings {
    settings: {
        __persistentVariables?: {
            [variableName: string]: any;
        };
        [key: string]: any;
    } = {};
    modified = false;

    constructor(public DocumentStore: DocumentStoreClass) {
        makeObservable(this, {
            settings: observable
        });
    }

    getVariableValue(variable: IVariable) {
        const persistentVariables = this.settings.__persistentVariables;

        if (!persistentVariables) {
            return undefined;
        }

        let value = persistentVariables[variable.name];
        if (!value) {
            return undefined;
        }

        const objectVariableType = ProjectEditor.getObjectVariableTypeFromType(
            variable.type
        );

        if (objectVariableType) {
            const constructorParams = value;
            return objectVariableType.createValue(
                constructorParams,
                this.DocumentStore.runtime ? true : false
            );
        }

        return value;
    }

    setVariableValue(variable: IVariable, value: any) {
        runInAction(() => {
            if (!this.settings.__persistentVariables) {
                this.settings.__persistentVariables = {};
            }
            this.settings.__persistentVariables[variable.name] = value;
        });
        this.modified = true;
    }

    async loadPersistentVariables() {
        const DocumentStore = this.DocumentStore;
        const globalVariables = DocumentStore.project.allGlobalVariables;
        const dataContext = DocumentStore.dataContext;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.getVariableValue(variable);
                if (value !== undefined) {
                    dataContext.set(variable.name, value);
                }
            }
        }
    }

    async savePersistentVariables() {
        const globalVariables = this.DocumentStore.project.allGlobalVariables;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.DocumentStore.dataContext.get(variable.name);
                if (value != null) {
                    const objectVariableType =
                        ProjectEditor.getObjectVariableTypeFromType(
                            variable.type
                        );
                    if (objectVariableType) {
                        const objectVariableValue:
                            | IObjectVariableValue
                            | undefined = value;

                        const constructorParams =
                            objectVariableValue?.constructorParams ?? null;

                        this.setVariableValue(variable, constructorParams);
                    } else {
                        this.setVariableValue(variable, value);
                    }
                }
            }
        }
    }

    getSettingsFilePath() {
        if (this.DocumentStore.filePath) {
            return this.DocumentStore.filePath + "-runtime-settings";
        }
        return undefined;
    }

    async load() {
        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            runInAction(() => {
                try {
                    this.settings = JSON.parse(data);
                } catch (err) {
                    console.error(err);
                    this.settings = {};
                }
            });
        } catch (err) {}
    }

    async save() {
        if (!this.modified) {
            return;
        }

        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(toJS(this.settings), undefined, "  "),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save runtime settings: " + err);
        }
    }
}