import { t } from "../../../i18n";
import { BaseWorkflow, WorkflowContext } from "../base";

export class FetchWorkflow extends BaseWorkflow {
    readonly id = "fetch";
    readonly label = "Fetch";

    constructor(private readonly _options?: { all?: boolean; remote?: string }) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        await ui.showProgress(t(locale, "fetchTitle"), async () => {
            await git.fetch(this._options);
            ui.notify(t(locale, "fetchSuccess"), "info");
            refresh();
        });
    }
}
