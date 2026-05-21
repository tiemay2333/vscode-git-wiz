import type * as vscode from "vscode";

/**
 * UIService 接口定义了工作流如何与用户交互。
 * 通过这个抽象层，我们可以解耦 Git 逻辑与 VSCode 具体 API，
 * 同时也方便了单元测试中的 Mock。
 */
export interface UIService {
    /**
     * 显示一个确认对话框。
     * @param message 确认信息
     * @param options 选项，例如 "Yes", "No", "Delete" 等
     */
    confirm: (message: string, options?: string[] | { modal?: boolean; detail?: string }, ...items: string[]) => Promise<string | undefined>;

    /**
     * 显示进度条并执行任务。
     * @param title 进度条标题
     * @param task 执行的任务
     */
    showProgress: <T>(title: string, task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>) => Promise<T>;

    /**
     * 显示通知消息。
     * @param message 消息内容
     * @param type 消息类型
     */
    notify: (message: string, type: "info" | "warning" | "error") => void;

    /**
     * 显示输入框。
     */
    showInputBox: (options?: vscode.InputBoxOptions) => Promise<string | undefined>;

    /**
     * 显示 QuickPick。
     */
    showQuickPick: <T extends vscode.QuickPickItem>(items: T[] | Promise<T[]>, options?: vscode.QuickPickOptions) => Promise<T | undefined>;
}
