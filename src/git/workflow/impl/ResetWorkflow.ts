import type * as vscode from "vscode";
import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class ResetWorkflow extends BaseWorkflow {
    readonly id = "reset";
    readonly label = "Reset";

    constructor(private readonly _hash: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        const items: (vscode.QuickPickItem & { value: string })[] = [
            { label: t(locale, "resetSoft"), description: t(locale, "resetSoftDesc"), value: "--soft" },
            { label: t(locale, "resetMixed"), description: t(locale, "resetMixedDesc"), value: "--mixed" },
            { label: t(locale, "resetHard"), description: t(locale, "resetHardDesc"), value: "--hard" },
        ];

        const resetType = await ui.showQuickPick(items, { placeHolder: t(locale, "selectResetType") });
        if (!resetType)
            return;

        const btnYes = t(locale, "confirm");
        const btnNo = t(locale, "cancel");

        const confirm = await ui.confirm(
            t(locale, "resetConfirm", { hash: this._hash.substring(0, 7), type: resetType.label }),
            [btnYes, btnNo],
        );
        if (confirm !== btnYes)
            return;

        await ui.showProgress(t(locale, "resetTitle", { hash: this._hash.substring(0, 7), type: resetType.label }), async () => {
            await git.ops.resetToCommit(this._hash, resetType.value);
            ui.notify(t(locale, "resetSuccess", { hash: this._hash.substring(0, 7) }), "info");
            refresh();
        });
    }
}
