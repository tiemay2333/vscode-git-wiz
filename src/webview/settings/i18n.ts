export type Locale = "zh" | "en";

const zh: Record<string, string> = {
    regularItems: "常规设置",
    highlightCurrentBranch: "高亮显示当前分支",
    highlightDesc: "当浏览其他分支时，高亮显示属于当前分支的提交",
    showTags: "显示标签",
    showTagsDesc: "在提交图中显示标签徽章",
    showRemoteBranches: "显示远程分支",
    showRemoteBranchesDesc: "在提交上显示远程分支名称（origin/...、upstream/...）",
    showGraph: "显示分支图",
    showGraphDesc: "在提交列表左侧显示分支路径追踪图",
    gitAuthor: "Git 作者",
    userName: "用户名",
    userNamePlaceholder: "你的名字",
    userEmail: "用户邮箱",
    userEmailPlaceholder: "you@example.com",
    global: "全局",
    local: "本地",
    remotes: "远程仓库",
    noRemotes: "未配置远程仓库",
    addRemote: "+ 添加远程仓库",
    removeRemote: "移除",
};

const en: Record<string, string> = {
    regularItems: "REGULAR ITEMS",
    highlightCurrentBranch: "Highlight Current Branch",
    highlightDesc: "Highlight commits belonging to the current branch when viewing other branches",
    showTags: "Show Tags",
    showTagsDesc: "Display tag badges on commits in the graph view",
    showRemoteBranches: "Show Remote Branches",
    showRemoteBranchesDesc: "Display remote branch names (origin/..., upstream/...) on commits",
    showGraph: "Show Branch Graph",
    showGraphDesc: "Display the branch path tracking graph on the left side of the commit list",
    gitAuthor: "Git Author",
    userName: "User Name",
    userNamePlaceholder: "Your Name",
    userEmail: "User Email",
    userEmailPlaceholder: "you@example.com",
    global: "Global",
    local: "Local",
    remotes: "Remotes",
    noRemotes: "No remotes configured",
    addRemote: "+ Add Remote",
    removeRemote: "Remove",
};

const localeMap: Record<Locale, Record<string, string>> = { zh, en };

export function t(locale: string, key: string): string {
    const lang = locale.startsWith("zh") ? "zh" : "en";
    return localeMap[lang]?.[key] ?? en[key] ?? key;
}
