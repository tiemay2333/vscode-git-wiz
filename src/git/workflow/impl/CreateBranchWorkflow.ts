import { t } from "@/locale/i18n";
import { BaseWorkflow, WorkflowContext } from "@/git/workflow/base";

export class CreateBranchWorkflow extends BaseWorkflow {
    readonly id = "create-branch";
    readonly label = "Create Branch";

    constructor(private readonly _sourceBranch: string, private readonly _newBranchName?: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        const newBranchName = this._newBranchName || await ui.showInputBox({
            prompt: t(locale, "branchCreatePrompt", { source: this._sourceBranch }),
            placeHolder: t(locale, "branchCreatePlaceholder"),
            validateInput: (value) => {
                if (!value || !value.trim()) {
                    return t(locale, "branchCreateEmptyError");
                }
                if (/[\s~^:?*[\\]|\.\./.test(value)) {
                    return t(locale, "branchCreateInvalidError");
                }
                return null;
            },
        });

        if (!newBranchName) return;

        await ui.showProgress(t(locale, "branchCreateTitle", { name: newBranchName, source: this._sourceBranch }), async () => {
            await git.checkoutBranch(newBranchName, { create: true, startPoint: this._sourceBranch });
            ui.notify(t(locale, "branchCreateSuccess", { name: newBranchName, source: this._sourceBranch }), "info");
            refresh();
        });
    }
}
