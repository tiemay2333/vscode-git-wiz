import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class PushTagWorkflow extends BaseWorkflow {
    readonly id = "push-tag";
    readonly label = "Push Tag";

    constructor(private readonly _tagName: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        const remotes = await git.getUniqueRemotes();
        if (remotes.length === 0) {
            ui.notify(t(locale, "noRemotes"), "error");
            return;
        }

        let targetRemote = remotes.find(r => r.name === "origin")?.name || remotes[0].name;
        if (remotes.length > 1) {
            const picked = await ui.showQuickPick(remotes.map(r => ({ label: r.name })), {
                placeHolder: t(locale, "selectRemote") || "Select a remote",
            });
            if (!picked) return;
            targetRemote = picked.label;
        }

        await ui.showProgress(t(locale, "workingOn", { action: t(locale, "tagPushPrompt") + ` "${this._tagName}"` }), async () => {
            await git.pushTag(targetRemote, this._tagName);
            ui.notify(t(locale, "operationSuccessful", { action: t(locale, "tagPushPrompt") + ` "${this._tagName}"` }), "info");
            refresh();
        });
    }
}
