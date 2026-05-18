import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class RevertWorkflow extends BaseWorkflow {
    readonly id = "revert";
    readonly label = "Revert";

    constructor(private readonly _hashes: string[]) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._hashes || this._hashes.length === 0) return;

        const isMulti = this._hashes.length > 1;
        const confirmMsg = isMulti 
            ? t(locale, "revertMultiConfirm", { count: this._hashes.length })
            : t(locale, "revertConfirm", { hash: this._hashes[0].substring(0, 7) });

        const btnYes = t(locale, "confirm");
        const btnNo = t(locale, "cancel");

        const confirm = await ui.confirm(confirmMsg, [btnYes, btnNo]);
        if (confirm !== btnYes) return;

        const title = isMulti
            ? t(locale, "revertMultiTitle", { count: this._hashes.length })
            : t(locale, "revertTitle", { hash: this._hashes[0].substring(0, 7) });

        await ui.showProgress(title, async () => {
            if (isMulti) {
                await git.revertCommits(this._hashes);
            } else {
                await git.revertCommit(this._hashes[0]);
            }
            
            ui.notify(
                isMulti
                    ? t(locale, "revertMultiSuccess", { count: this._hashes.length })
                    : t(locale, "revertSuccess", { hash: this._hashes[0].substring(0, 7) }),
                "info"
            );
            
            refresh();
        });
    }
}
