import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class CherryPickWorkflow extends BaseWorkflow {
    readonly id = "cherry-pick";
    readonly label = "Cherry-pick";

    constructor(private readonly _hashes: string[]) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._hashes || this._hashes.length === 0) return;

        const isRange = this._hashes.length > 1;
        const title = isRange 
            ? t(locale, "cherryPickTitle", { count: this._hashes.length }) 
            : t(locale, "cherryPickSingleTitle", { hash: this._hashes[0].substring(0, 7) });

        await ui.showProgress(title, async () => {
            if (isRange) {
                await git.cherryPickRange(this._hashes);
            } else {
                await git.cherryPickCommit(this._hashes[0]);
            }
            
            ui.notify(
                isRange 
                    ? t(locale, "cherryPickSuccess", { count: this._hashes.length }) 
                    : t(locale, "cherryPickSingleSuccess", { hash: this._hashes[0].substring(0, 7) }), 
                "info"
            );
            
            refresh();
        });
    }
}
