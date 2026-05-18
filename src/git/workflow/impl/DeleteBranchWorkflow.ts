import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class DeleteBranchWorkflow extends BaseWorkflow {
    readonly id = "delete-branch";
    readonly label = "Delete Branch"; // Use English as base label for internal tracking

    constructor(private readonly _branchName: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._branchName) return;

        const upstream = await git.getUpstream(this._branchName);

        const btnDeleteBoth = t(locale, "deleteBoth");
        const btnDeleteLocal = t(locale, "deleteLocalOnly");
        const btnCancel = t(locale, "cancel");
        const btnConfirm = t(locale, "confirm");
        const btnForceDelete = t(locale, "forceDelete");

        let confirm: string | undefined;
        if (upstream) {
            confirm = await ui.confirm(
                t(locale, "deleteBranchUpstreamConfirm", { name: this._branchName, upstream }),
                [btnDeleteBoth, btnDeleteLocal, btnCancel]
            );
        } else {
            confirm = await ui.confirm(
                t(locale, "deleteBranchConfirm", { name: this._branchName }),
                [btnConfirm, btnCancel]
            );
        }

        if (![btnConfirm, btnDeleteLocal, btnDeleteBoth].includes(confirm || "")) {
            return;
        }

        const doDeleteRemote = confirm === btnDeleteBoth;

        await ui.showProgress(t(locale, "workingOn", { action: t(locale, "deleteBranch") + ` "${this._branchName}"` }), async () => {
            try {
                await git.deleteBranch(this._branchName, false);
            } catch (err: any) {
                if (err.message.includes("not fully merged")) {
                    const forceConfirm = await ui.confirm(
                        t(locale, "forceDeleteConfirm", { name: this._branchName }),
                        [btnForceDelete, btnCancel]
                    );
                    if (forceConfirm !== btnForceDelete) {
                        return;
                    }
                    await git.deleteBranch(this._branchName, true);
                } else {
                    throw err;
                }
            }

            if (doDeleteRemote && upstream) {
                try {
                    const firstSlash = upstream.indexOf("/");
                    if (firstSlash !== -1) {
                        const remoteName = upstream.substring(0, firstSlash);
                        const remoteBranch = upstream.substring(firstSlash + 1);
                        await git.deleteRemoteBranch(remoteName, remoteBranch);
                        ui.notify(t(locale, "deleteBranchAllSuccess", { name: this._branchName, upstream }), "info");
                    }
                } catch (err: any) {
                    ui.notify(t(locale, "deleteRemoteBranchFailed", { error: err.message }), "error");
                }
            } else {
                ui.notify(t(locale, "deleteBranchSuccess", { name: this._branchName }), "info");
            }

            refresh();
        });
    }
}
