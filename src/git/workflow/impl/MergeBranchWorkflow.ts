import { t } from "@/locale/i18n";
import { BaseWorkflow, WorkflowContext } from "@/git/workflow/base";

export class MergeBranchWorkflow extends BaseWorkflow {
    readonly id = "merge-branch";
    readonly label = "Merge Branch";

    constructor(private readonly _sourceBranch: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        await ui.showProgress(t(locale, "mergeTitle", { name: this._sourceBranch }), async () => {
            const result = await git.mergeBranch(this._sourceBranch);
            if (!result.success) {
                if (result.isConflict) {
                    const btnAbort = t(locale, "mergeAbort");
                    const btnClose = t(locale, "cancel");
                    const choice = await ui.confirm(
                        t(locale, "mergeConflictError", { error: result.error || "" }),
                        [btnAbort, btnClose]
                    );
                    if (choice === btnAbort) {
                        await git.abortMerge();
                        ui.notify(t(locale, "mergeAborted"), "info");
                    }
                } else {
                    throw new Error(result.error);
                }
            } else {
                ui.notify(t(locale, "mergeSuccess", { name: this._sourceBranch }), "info");
            }
            refresh();
        });
    }
}
