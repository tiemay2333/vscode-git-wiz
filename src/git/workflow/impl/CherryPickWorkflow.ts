import { BaseWorkflow, WorkflowContext } from "../base";

export class CherryPickWorkflow extends BaseWorkflow {
    readonly id = "cherry-pick";
    readonly label = "Cherry-pick";

    constructor(private readonly _hashes: string[]) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh } = context;

        if (!this._hashes || this._hashes.length === 0) return;

        const isRange = this._hashes.length > 1;
        const title = isRange 
            ? `正在 Cherry-pick ${this._hashes.length} 个提交...` 
            : `正在 Cherry-pick 提交 ${this._hashes[0].substring(0, 7)}...`;

        await ui.showProgress(title, async () => {
            if (isRange) {
                await git.cherryPickRange(this._hashes);
            } else {
                await git.cherryPickCommit(this._hashes[0]);
            }
            
            ui.notify(
                isRange 
                    ? `成功 Cherry-pick 了 ${this._hashes.length} 个提交` 
                    : `成功 Cherry-pick 了提交 ${this._hashes[0].substring(0, 7)}`, 
                "info"
            );
            
            refresh();
        });
    }
}
