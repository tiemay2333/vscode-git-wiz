import { t } from "@/locale/i18n";
import { BaseWorkflow, WorkflowContext } from "@/git/workflow/base";
import { PushTagWorkflow } from "./PushTagWorkflow";

export class CreateTagWorkflow extends BaseWorkflow {
    readonly id = "create-tag";
    readonly label = "Create Tag";

    constructor(private readonly _commitHash: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh, locale } = context;

        const tagName = await ui.showInputBox({
            prompt: t(locale, "tagCreatePrompt") || "Enter new tag name",
            placeHolder: "e.g. v1.0.0",
        });

        if (!tagName) return;

        await ui.showProgress(t(locale, "tagCreateTitle", { name: tagName }), async () => {
            await git.createTag(tagName, this._commitHash);
            
            const btnPush = t(locale, "tagPushPrompt");
            const action = await ui.confirm(
                t(locale, "tagCreateSuccess", { name: tagName }),
                [btnPush, t(locale, "cancel")]
            );
            
            refresh();

            if (action === btnPush) {
                // Execute push tag workflow
                // We can just instantiate and run it manually since we are already in an engine execution context?
                // No, the engine manages locks. But we ARE the lock holder.
                // However, the engine might not support recursive execution easily.
                // Let's just run the logic directly or through context.
                const pushWorkflow = new PushTagWorkflow(tagName);
                await pushWorkflow.run(context);
            }
        });
    }
}
