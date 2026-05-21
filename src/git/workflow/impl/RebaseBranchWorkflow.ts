import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class RebaseBranchWorkflow extends BaseWorkflow {
    readonly id = "rebase-branch";
    readonly label = "Rebase Branch";

    constructor(private readonly _targetBranch: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;
        await ui.showProgress(t(locale, "rebasing", { branch: this._targetBranch }), async () => {
            await git.ops.rebaseBranch(this._targetBranch);
            ui.notify(t(locale, "rebaseSuccess", { branch: this._targetBranch }), "info");
        });
        refresh();
    }
}
