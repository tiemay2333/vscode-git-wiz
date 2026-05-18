import { t } from "@/locale/i18n";
import { BaseWorkflow, WorkflowContext } from "@/git/workflow/base";

export class PullWorkflow extends BaseWorkflow {
    readonly id = "pull";
    readonly label = "Pull";

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        await ui.showProgress(t(locale, "pullTitle"), async () => {
            await git.pull();
            ui.notify(t(locale, "pullSuccess"), "info");
            refresh();
        });
    }
}
