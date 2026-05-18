import type { GitRunner } from "./GitRunner";

export class ConfigManager {
    constructor(private readonly runner: GitRunner) { }

    async getGitConfig(key: string, scope: "local" | "global"): Promise<string> {
        const scopeArg = scope === "global" ? "--global" : "--local";
        const result = await this.runner.exec(["config", scopeArg, key]);
        return result.exitCode === 0 ? result.stdout.trim() : "";
    }

    async setGitConfig(key: string, value: string, scope: "local" | "global"): Promise<void> {
        const scopeArg = scope === "global" ? "--global" : "--local";
        await this.runner.exec(["config", scopeArg, key, value]);
    }
}
