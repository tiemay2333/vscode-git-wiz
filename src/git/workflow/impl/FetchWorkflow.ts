import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class FetchWorkflow extends BaseWorkflow {
    readonly id = "fetch";
    readonly label = "Fetch";

    constructor(private readonly _options?: { all?: boolean; remote?: string }) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;
        await ui.showProgress(t(locale, "fetching"), async () => {
            await git.ops.fetch(this._options);
            ui.notify(t(locale, "fetchSuccess"), "info");
        });
        refresh();
    }
}
