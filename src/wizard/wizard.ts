import * as azdata from "azdata";
import { ConnectionModel } from "./api/models";
import { Page1 } from "./pages/page1";

export class ConnectionWizard {
  public wizard: azdata.window.Wizard;
  public model: ConnectionModel;

  constructor() {
    this.wizard = azdata.window.createWizard("Connection Wizard");
    this.model = <ConnectionModel>{};
  }

  public async start() {
    let page1 = azdata.window.createWizardPage("Select Server and Database");
    let resolvePage1Instance: (value: Page1) => void;
    let page1InstancePromise = new Promise<Page1>((resolve) => {
      resolvePage1Instance = resolve;
    });

    page1.registerContent(async (view) => {
      let page1Instance = new Page1(page1, this.model, view, 700);
      await page1Instance.start();
      resolvePage1Instance(page1Instance);
    });

    this.wizard.onPageChanged(async (event) => {
      if (event.newPage === 0) {
        // page1 is at index 0
        let page1Instance = await page1InstancePromise; // Wait for the Promise to resolve
        await page1Instance.onPageEnter();
      }
    });

    this.wizard.pages = [page1];
    this.wizard.open();
  }
}
