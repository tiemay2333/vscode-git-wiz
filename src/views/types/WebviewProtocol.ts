import type { GitCommit } from "@/git/utils/gitParser";

/**
 * Commands sent from Plugin to Webview
 */
export type ToWebviewMessage
    = | { command: "updateCommitHighlight"; hash: string; verificationStatus: string }
        | { command: "setLoading"; visible: boolean }
        | { command: "replaceCommits"; commits: GitCommit[]; uiStatus: Record<string, any>; hasMore: boolean; filterBranch: string | null; filterFile: string | null; currentBranch: string | null; resetScroll: boolean; highlightCurrentBranch: boolean; showTags: boolean; showRemoteBranches: boolean; showGraph: boolean }
        | { command: "appendCommits"; commits: GitCommit[]; uiStatus: Record<string, any>; hasMore: boolean; showTags: boolean; showRemoteBranches: boolean; showGraph: boolean }
        | { command: "replaceBranches"; branches: any[] }
        | { command: "showSettingsModal"; data: { highlightCurrentBranch: boolean; showTags: boolean; showRemoteBranches: boolean; showGraph: boolean; searchDefaultMode: string; userName: string; userEmail: string; scope: "local" | "global"; remotes: { name: string; url: string }[]; locale: string } }
        | { command: "commitFilesData"; commitHash: string; files?: any[]; error?: string }
        | { command: "updateShowTags"; value: boolean }
        | { command: "updateShowRemoteBranches"; value: boolean }
        | { command: "updateShowGraph"; value: boolean }
        | { command: "updateSearchDefaultMode"; value: string }
        | { command: "settingsUpdateForm"; userName?: string; userEmail?: string; remotes?: { name: string; url: string }[] };

/**
 * Commands sent from Webview to Plugin
 */
export type FromWebviewMessage
    = | { command: "ready" }
        | { command: "reverifyCommit"; commitHash: string }
        | { command: "cherryPick"; commitHash: string }
        | { command: "copyHash"; commitHash: string }
        | { command: "copyCommitMessage"; commitMessage: string }
        | { command: "revertCommit"; commitHash: string }
        | { command: "resetToCommit"; commitHash: string }
        | { command: "dropCommit"; commitHash: string; parentHash: string }
        | { command: "squashCommits"; hashes: string[]; parentHash: string }
        | { command: "cherryPickRange"; hashes: string[] }
        | { command: "revertCommits"; hashes: string[] }
        | { command: "dropCommits"; hashes: string[]; parentHash: string }
        | { command: "pushTag"; tagName: string }
        | { command: "newTag"; commitHash: string }
        | { command: "createBranch"; commitHash?: string; branchName?: string }
        | { command: "selectBranch"; branchName: string | null }
        | { command: "deleteMultipleBranches"; branchNames: string[] }
        | { command: "createBranchFromTag"; tagName: string }
        | { command: "deleteTag"; tagName: string }
        | { command: "checkoutBranch"; branchName: string; isRemote?: boolean }
        | { command: "deleteBranch"; branchName: string }
        | { command: "deleteRemoteBranch"; branchName: string }
        | { command: "rebaseBranch"; branchName: string }
        | { command: "mergeBranch"; branchName: string }
        | { command: "saveFilesViewMode"; mode: "list" | "tree" }
        | { command: "saveCommitDetailsViewMode"; mode: "list" | "tree" }
        | { command: "settingsUpdateSetting"; key: string; value: any }
        | { command: "settingsSetGitConfig"; key: string; value: string; scope: "local" | "global" }
        | { command: "settingsGetGitConfig"; scope: "local" | "global" }
        | { command: "settingsAddRemote" }
        | { command: "settingsFetchRemote"; remoteName: string }
        | { command: "settingsRemoveRemote"; remoteName: string }
        | { command: "getCommitFiles"; commitHash: string }
        | { command: "openDiff"; commitHash: string; filePath: string; parentHash?: string }
        | { command: "openFile"; filePath: string }
        | { command: "search"; filters: { query?: string; author?: string; from?: string; to?: string } }
        | { command: "refresh" }
        | { command: "clearBranchFilter" }
        | { command: "filterByFile"; filePath: string | null }
        | { command: "clearFileFilter" }
        | { command: "loadMoreCommits" }
        | { command: "showErrorMessage"; error: string }
        | { command: "requestUnfilteredCommits" };
