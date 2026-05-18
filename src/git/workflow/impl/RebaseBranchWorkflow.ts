import { t } from "@/locale/i18n";
import { BaseWorkflow, WorkflowContext } from "@/git/workflow/base";

export class RebaseBranchWorkflow extends BaseWorkflow {
    readonly id = "rebase-branch";
    readonly label = "Rebase Branch";

    constructor(private readonly _targetBranch: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        await ui.showProgress(t(locale, "rebaseTitle", { name: this._targetBranch }), async () => {
            await git.rebaseBranch(this._targetBranch);
            ui.notify(t(locale, "rebaseSuccess", { name: this._targetBranch }), "info");
            refresh();
        });
    }
}
