import { BaseWorkflow, WorkflowContext } from "../base";

export class DeleteBranchWorkflow extends BaseWorkflow {
    readonly id = "delete-branch";
    readonly label = "删除分支";

    constructor(private readonly _branchName: string) {
        super();
    }

    async run(context: WorkflowContext): Promise<void> {
        const { git, ui, refresh } = context;

        if (!this._branchName) return;

        const upstream = await git.getUpstream(this._branchName);

        let confirm: string | undefined;
        if (upstream) {
            confirm = await ui.confirm(
                `确定要删除分支 "${this._branchName}" 吗？它有一个远程跟踪分支 "${upstream}"。`,
                ["删除两者", "仅删除本地", "取消"]
            );
        } else {
            confirm = await ui.confirm(
                `确定要删除分支 "${this._branchName}" 吗？`,
                ["确定", "取消"]
            );
        }

        if (!["确定", "仅删除本地", "删除两者"].includes(confirm || "")) {
            return;
        }

        const doDeleteRemote = confirm === "删除两者";

        await ui.showProgress(`正在删除分支 "${this._branchName}"...`, async () => {
            try {
                await git.deleteBranch(this._branchName, false);
            } catch (err: any) {
                if (err.message.includes("not fully merged")) {
                    const forceConfirm = await ui.confirm(
                        `分支 "${this._branchName}" 尚未完全合并。是否强制删除？`,
                        ["强制删除", "取消"]
                    );
                    if (forceConfirm !== "强制删除") {
                        return;
                    }
                    await git.deleteBranch(this._branchName, true);
                } else {
                    throw err;
                }
            }

            if (doDeleteRemote && upstream) {
                try {
                    const firstSlash = upstream.indexOf("/");
                    if (firstSlash !== -1) {
                        const remoteName = upstream.substring(0, firstSlash);
                        const remoteBranch = upstream.substring(firstSlash + 1);
                        await git.deleteRemoteBranch(remoteName, remoteBranch);
                        ui.notify(`已删除本地分支 "${this._branchName}" 及其远程跟踪分支 "${upstream}"`, "info");
                    }
                } catch (err: any) {
                    ui.notify(`已删除本地分支，但删除远程分支失败: ${err.message}`, "error");
                }
            } else {
                ui.notify(`已删除分支 "${this._branchName}"`, "info");
            }

            refresh();
        });
    }
}
