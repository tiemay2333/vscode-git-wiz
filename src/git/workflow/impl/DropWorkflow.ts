import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class DropWorkflow extends BaseWorkflow {
    readonly id = "drop";
    readonly label = "Drop";

    constructor(private readonly _hashes: string[], private readonly _parentHash: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._hashes || this._hashes.length === 0)
            return;

        const isMulti = this._hashes.length > 1;
        const confirmMsg = isMulti
            ? t(locale, "dropMultiConfirm", { count: this._hashes.length })
            : t(locale, "dropConfirm", { hash: this._hashes[0].substring(0, 7) });

        const btnDrop = t(locale, "forceDelete"); // Reusing "Force Delete" label or use a specific one? "Confirm" is safer
        const btnCancel = t(locale, "cancel");

        const confirm = await ui.confirm(confirmMsg, [btnDrop, btnCancel]);
        if (confirm !== btnDrop)
            return;

        const title = isMulti
            ? t(locale, "dropMultiTitle", { count: this._hashes.length })
            : t(locale, "dropTitle", { hash: this._hashes[0].substring(0, 7) });

        await ui.showProgress(title, async () => {
            if (this._hashes.length > 1) {
                await git.ops.dropCommits(this._hashes, this._parentHash);
            }
            else {
                await git.ops.dropCommit(this._hashes[0]);
            }

            ui.notify(
                isMulti
                    ? t(locale, "dropMultiSuccess", { count: this._hashes.length })
                    : t(locale, "dropSuccess", { hash: this._hashes[0].substring(0, 7) }),
                "info",
            );

            refresh();
        });
    }
}
