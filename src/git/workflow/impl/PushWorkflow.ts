import type { WorkflowContext } from "@/git/workflow/base";
import { BaseWorkflow } from "@/git/workflow/base";
import { t } from "@/locale/i18n";

export class PushWorkflow extends BaseWorkflow {
    readonly id = "push";
    readonly label = "Push";

    constructor(private readonly _options?: { force?: boolean; setUpstream?: string }) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        const title = this._options?.force ? t(locale, "pushForceTitle") : t(locale, "pushTitle");

        await ui.showProgress(title, async () => {
            try {
                await git.ops.push(this._options);
                ui.notify(this._options?.force ? t(locale, "pushForceSuccess") : t(locale, "pushSuccess"), "info");
                refresh();
            }
            catch (err: any) {
                if (err.message.includes("has no upstream branch")) {
                    const branch = await git.refs.getCurrentBranch();
                    if (!branch) {
                        throw err;
                    }
                    await git.ops.push({ ...this._options, setUpstream: branch });
                    ui.notify(t(locale, "pushUpstreamSuccess"), "info");
                    refresh();
                }
                else {
                    throw err;
                }
            }
        });
    }
}
