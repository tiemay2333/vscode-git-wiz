import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class RevertWorkflow extends BaseWorkflow {
    readonly id = "revert";
    readonly label = "Revert";

    constructor(private readonly _hashes: string[]) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._hashes || this._hashes.length === 0)
            return;

        const isMulti = this._hashes.length > 1;
        const confirmMsg = isMulti
            ? t(locale, "revertMultiConfirm", { count: this._hashes.length })
            : t(locale, "revertConfirm", { hash: this._hashes[0].substring(0, 7) });

        const btnYes = t(locale, "confirm");
        const btnNo = t(locale, "cancel");

        const confirm = await ui.confirm(confirmMsg, [btnYes, btnNo]);
        if (confirm !== btnYes)
            return;

        const title = isMulti
            ? t(locale, "revertMultiTitle", { count: this._hashes.length })
            : t(locale, "revertTitle", { hash: this._hashes[0].substring(0, 7) });

        await ui.showProgress(title, async () => {
            if (this._hashes.length > 1) {
                await git.ops.revertCommits(this._hashes);
            }
            else {
                await git.ops.revertCommit(this._hashes[0]);
            }

            ui.notify(
                isMulti
                    ? t(locale, "revertMultiSuccess", { count: this._hashes.length })
                    : t(locale, "revertSuccess", { hash: this._hashes[0].substring(0, 7) }),
                "info",
            );

            refresh();
        });
    }
}
