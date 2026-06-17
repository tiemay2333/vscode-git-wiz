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
        await ui.showProgress(t(locale, "rebaseTitle", { name: this._targetBranch }), async () => {
            const result = await git.ops.rebaseBranch(this._targetBranch);
            if (!result.success) {
                if (result.isRebaseInProgress) {
                    const btnAbort = t(locale, "rebaseAbort");
                    const btnClose = t(locale, "cancel");
                    const message = result.isConflict
                        ? t(locale, "rebaseConflictError", { error: result.error || "" })
                        : t(locale, "rebaseFailedError", { error: result.error || "" });
                    const choice = await ui.confirm(
                        message,
                        [btnAbort, btnClose],
                    );
                    if (choice === btnAbort) {
                        await git.ops.abortRebase();
                        ui.notify(t(locale, "rebaseAborted"), "info");
                    }
                }
                else {
                    throw new Error(result.error);
                }
            }
            else {
                ui.notify(t(locale, "rebaseSuccess", { name: this._targetBranch }), "info");
            }
            refresh();
        });
    }
}
