import * as azdata from "azdata";
import * as vscode from "vscode";
import { ConnectionModel } from "../api/models";
import { BasePage } from "../api/basePage";

/**
 * Represents the first page of the Wizard, which allows the user to select
 * one of their active connections, and a specific database within the connection to work with
 */
export class Page1 extends BasePage {
  private cellDropdowns: Map<string, azdata.DropDownComponent> = new Map();
  private connectionOptions: Map<string, azdata.connection.ConnectionProfile> =
    new Map();

  public constructor(
    wizardPage: azdata.window.WizardPage,
    model: ConnectionModel,
    view: azdata.ModelView,
    width: number
  ) {
    super(wizardPage, model, view, width);
    this.model.cellConnections = new Map<
      string,
      azdata.connection.ConnectionProfile
    >();
  }

  async start(): Promise<boolean> {
    let descriptionComponent = {
      component: this.view.modelBuilder.text().component(),
      title:
        "This Wizard will help you assign different connections to individual SQL notebook cells.",
    };

    let formBuilder = this.view.modelBuilder.formContainer();

    let cells: azdata.nb.NotebookCell[] = this.getNotebookCells();
    cells.forEach((cell, index) => {
      let cellDropdown = this.createCellDropdown(String(index));
      this.cellDropdowns.set(String(index), cellDropdown);
      formBuilder.addFormItem({
        component: cellDropdown,
        title: `Select a Connection for Cell ${index + 1}:`,
      });
    });

    let runButton = this.view.modelBuilder
      .button()
      .withProperties({
        label: "Run All Cells with Selected Connections",
        width: "100%",
      })
      .component();

    runButton.onDidClick(async () => {
      await this.runAllWithSelectedConnections();
    });

    formBuilder.addFormItem({
      component: runButton,
    });

    let layout: azdata.FormLayout = { width: this.width };
    formBuilder.withLayout(layout);

    await this.view.initializeModel(formBuilder.component());
    return true;
  }

  async onPageEnter(): Promise<boolean> {
    let r1 = await this.populateConnectionDropdowns();
    return r1;
  }

  private createCellDropdown(cellId: string): azdata.DropDownComponent {
    let cellDropdown = this.view.modelBuilder
      .dropDown()
      .withProperties({
        required: true,
      })
      .component();

    // Handle connection changes
    cellDropdown.onValueChanged(async () => {
      let connection = Array.from(this.connectionOptions.values()).find(
        (conn) => this.getDisplayName(conn) === String(cellDropdown.value)
      );
      if (connection) {
        this.model.cellConnections.set(cellId, connection);
      }
    });

    return cellDropdown;
  }

  private async populateConnectionDropdowns(): Promise<boolean> {
    let connectionsExist = await this.getConnectionValues();
    if (!connectionsExist) {
      vscode.window.showErrorMessage(
        "Connect to a server first to use this wizard."
      );
      return false;
    }

    let connections: string[] = Array.from(this.connectionOptions.values()).map(
      (conn) => this.getDisplayName(conn)
    );

    this.cellDropdowns.forEach((dropdown) => {
      dropdown.updateProperties({
        values: connections,
      });
    });

    return true;
  }

  private getDisplayName(
    connection: azdata.connection.ConnectionProfile
  ): string {
    return `${connection.serverName}.${connection.databaseName}`;
  }

  private async getConnectionValues(): Promise<boolean> {
    let connections = await azdata.connection.getConnections(false);

    console.log("Retrieved connections:", connections); // Add this line

    if (!connections || connections.length === 0) {
      return false;
    }

    for (let connection of connections) {
      console.log("Connection ID:", connection.connectionId); // And this line
      this.connectionOptions.set(connection.connectionId, connection);
    }

    return true;
  }

  public async runAllWithSelectedConnections(): Promise<void> {
    let editor = azdata.nb.activeNotebookEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active notebook editor.");
      return;
    }

    for (let [cellId, connection] of this.model.cellConnections) {
      let cell = editor.document.cells[Number(cellId)];
      if (!cell) {
        continue;
      }

      let iConnection = this.toIConnectionProfile(connection);
      await editor.(iConnection);
      console.log(`Switched connection for cell ${cellId}`);

      await editor.runCell(cell);
      console.log(`Ran cell ${cellId}`);
    }

    vscode.window.showInformationMessage(
      "Cells run with selected connections."
    );
  }

  private toIConnectionProfile(
    connection: azdata.connection.ConnectionProfile
  ): azdata.IConnectionProfile {
    return {
      ...connection,
      providerName: "MSSQL", // replace with the actual provider name
      id: connection.connectionId,
    };
  }

  private getNotebookCells(): azdata.nb.NotebookCell[] {
    let editor = azdata.nb.activeNotebookEditor;
    if (editor) {
      return editor.document.cells;
    } else {
      return [];
    }
  }
}
