import { t } from "@/locale/i18n";
import { BaseWorkflow, WorkflowContext } from "@/git/workflow/base";

export class DeleteRemoteBranchWorkflow extends BaseWorkflow {
    readonly id = "delete-remote-branch";
    readonly label = "Delete Remote Branch";

    constructor(private readonly _fullName: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._fullName) return;

        const firstSlash = this._fullName.indexOf("/");
        if (firstSlash === -1) {
            ui.notify(`Invalid remote branch name: ${this._fullName}`, "error");
            return;
        }

        const remote = this._fullName.substring(0, firstSlash);
        const branch = this._fullName.substring(firstSlash + 1);

        const btnDelete = t(locale, "confirm");
        const btnCancel = t(locale, "cancel");

        const confirm = await ui.confirm(
            t(locale, "deleteRemoteConfirm", { remote, branch }),
            { modal: true },
            btnDelete, btnCancel
        );

        if (confirm !== btnDelete) return;

        await ui.showProgress(t(locale, "deleteRemoteTitle", { branch }), async () => {
            await git.deleteRemoteBranch(remote, branch);
            ui.notify(t(locale, "deleteRemoteSuccess", { remote, branch }), "info");
            refresh();
        });
    }
}
