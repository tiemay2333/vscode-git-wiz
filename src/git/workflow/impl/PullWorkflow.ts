import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class PullWorkflow extends BaseWorkflow {
    readonly id = "pull";
    readonly label = "Pull";

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;
        await ui.showProgress(t(locale, "pulling"), async () => {
            await git.ops.pull();
            ui.notify(t(locale, "pullSuccess"), "info");
        });
        refresh();
    }
}
