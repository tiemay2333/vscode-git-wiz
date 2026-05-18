import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class SquashWorkflow extends BaseWorkflow {
    readonly id = "squash";
    readonly label = "Squash";

    constructor(private readonly _hashes: string[], private readonly _parentHash: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        if (!this._hashes || this._hashes.length === 0) return;

        const newMessage = await ui.showInputBox({
            prompt: t(locale, "squashPrompt", { count: this._hashes.length }),
            placeHolder: t(locale, "squashPlaceholder"),
            validateInput: v => (!v || !v.trim() ? t(locale, "squashEmptyError") : null),
        });
        if (!newMessage) return;

        await ui.showProgress(t(locale, "squashTitle", { count: this._hashes.length }), async () => {
            await git.squashCommits(this._hashes, this._parentHash, newMessage);
            ui.notify(t(locale, "squashSuccess", { count: this._hashes.length }), "info");
            refresh();
        });
    }
}
