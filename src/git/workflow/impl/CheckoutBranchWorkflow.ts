import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class CheckoutBranchWorkflow extends BaseWorkflow {
    readonly id = "checkout-branch";
    readonly label = "Checkout Branch";

    constructor(private readonly _branchName: string, private readonly _options?: { track?: boolean; remote?: string; localName?: string }) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (this._options?.remote) {
            // Checkout remote branch case
            const remote = this._options.remote;
            const localBranchName = this._options.localName || this._branchName.split("/").slice(1).join("/");

            await ui.showProgress(t(locale, "checkoutRemoteTitle", { remote, name: this._branchName }), async () => {
                try {
                    await git.fetch({ remote });
                    await git.checkoutBranch(this._branchName, { track: true });
                    ui.notify(t(locale, "checkoutRemoteSuccess", { name: this._branchName }), "info");
                } catch (err: any) {
                    try {
                        await git.checkoutBranch(localBranchName);
                        ui.notify(t(locale, "checkoutExistingSuccess", { name: localBranchName }), "info");
                    } catch {
                        throw err;
                    }
                }
                refresh();
            });
        } else {
            // Simple checkout
            await ui.showProgress(t(locale, "checkoutTitle", { name: this._branchName }), async () => {
                try {
                    await git.checkoutBranch(this._branchName, { track: this._options?.track });
                    ui.notify(t(locale, "checkoutSuccess", { name: this._branchName }), "info");
                } catch (err: any) {
                    // Fallback: simple checkout if --track fails
                    try {
                        await git.checkoutBranch(this._branchName);
                        ui.notify(t(locale, "checkoutSuccess", { name: this._branchName }), "info");
                    } catch {
                        throw err;
                    }
                }
                refresh();
            });
        }
    }
}
