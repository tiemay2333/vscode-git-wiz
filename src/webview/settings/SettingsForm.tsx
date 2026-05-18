import { useCallback, useEffect, useState } from "react";
import { vscode } from "../vscodeApi";
import { t } from "../../i18n";

export interface SettingsData {
    highlightCurrentBranch: boolean;
    showTags: boolean;
    showRemoteBranches: boolean;
    showGraph: boolean;
    searchDefaultMode: "single" | "graph";
    userName: string;
    userEmail: string;
    scope: "local" | "global";
    remotes: { name: string; url: string }[];
    locale: string;
}

export function SettingsForm({ data }: { data: SettingsData }) {
    const [highlight, setHighlight] = useState(data.highlightCurrentBranch);
    const [showTags, setShowTags] = useState(data.showTags);
    const [showRemoteBranches, setShowRemoteBranches] = useState(data.showRemoteBranches);
    const [showGraph, setShowGraph] = useState(data.showGraph);
    const [searchDefaultMode, setSearchDefaultMode] = useState(data.searchDefaultMode);
    const [userName, setUserName] = useState(data.userName);
    const [userEmail, setUserEmail] = useState(data.userEmail);
    const [scope, setScope] = useState(data.scope);
    const [remotes, setRemotes] = useState(data.remotes);
    const locale = data.locale;
    const [nameChanged, setNameChanged] = useState(false);
    const [emailChanged, setEmailChanged] = useState(false);

    const toggleHighlight = useCallback(() => {
        const newVal = !highlight;
        setHighlight(newVal);
        vscode.postMessage({ command: "settingsUpdateSetting", key: "highlightCurrentBranch", value: newVal });
    }, [highlight]);

    const toggleShowTags = useCallback(() => {
        const newVal = !showTags;
        setShowTags(newVal);
        vscode.postMessage({ command: "settingsUpdateSetting", key: "showTags", value: newVal });
    }, [showTags]);

    const toggleShowRemoteBranches = useCallback(() => {
        const newVal = !showRemoteBranches;
        setShowRemoteBranches(newVal);
        vscode.postMessage({ command: "settingsUpdateSetting", key: "showRemoteBranches", value: newVal });
    }, [showRemoteBranches]);

    const toggleShowGraph = useCallback(() => {
        const newVal = !showGraph;
        setShowGraph(newVal);
        vscode.postMessage({ command: "settingsUpdateSetting", key: "showGraph", value: newVal });
    }, [showGraph]);

    const changeSearchDefaultMode = useCallback((mode: "single" | "graph") => {
        setSearchDefaultMode(mode);
        vscode.postMessage({ command: "settingsUpdateSetting", key: "searchDefaultMode", value: mode });
    }, []);

    const applyUserName = useCallback(() => {
        if (!nameChanged)
            return;
        vscode.postMessage({ command: "settingsSetGitConfig", key: "user.name", value: userName, scope });
        setNameChanged(false);
    }, [nameChanged, userName, scope]);

    const applyUserEmail = useCallback(() => {
        if (!emailChanged)
            return;
        vscode.postMessage({ command: "settingsSetGitConfig", key: "user.email", value: userEmail, scope });
        setEmailChanged(false);
    }, [emailChanged, userEmail, scope]);

    const changeScope = useCallback((newScope: "local" | "global") => {
        setScope(newScope);
        vscode.postMessage({ command: "settingsGetGitConfig", scope: newScope });
    }, []);

    const addRemote = useCallback(() => {
        vscode.postMessage({ command: "settingsAddRemote" });
    }, []);

    const removeRemote = useCallback((name: string) => {
        vscode.postMessage({ command: "settingsRemoveRemote", remoteName: name });
    }, []);

    // Listen for extension responses
    const handleMessage = useCallback((e: MessageEvent) => {
        const msg = e.data;
        if (msg.command === "settingsUpdateForm") {
            if (msg.userName !== undefined)
                setUserName(msg.userName);
            if (msg.userEmail !== undefined)
                setUserEmail(msg.userEmail);
            if (msg.remotes)
                setRemotes(msg.remotes);
        }
    }, []);

    useEffect(() => {
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [handleMessage]);

    return (
        <div style={{ padding: "20px 24px", maxWidth: 520, fontFamily: "var(--vscode-font-family)", fontSize: "13px", color: "var(--vscode-foreground)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--vscode-descriptionForeground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                {t(locale, "regularItems")}
            </div>

            {/* Highlight toggle — switch on right */}
            <div className="settings-row">
                <div className="settings-row-label">
                    <div className="settings-row-title">{t(locale, "highlightCurrentBranch")}</div>
                    <div className="settings-row-desc">{t(locale, "highlightDesc")}</div>
                </div>
                <label className="toggle-switch">
                    <input type="checkbox" checked={highlight} onChange={toggleHighlight} />
                    <span className="toggle-slider" />
                </label>
            </div>

            {/* Show Tags toggle — switch on right */}
            <div className="settings-row">
                <div className="settings-row-label">
                    <div className="settings-row-title">{t(locale, "showTags")}</div>
                    <div className="settings-row-desc">{t(locale, "showTagsDesc")}</div>
                </div>
                <label className="toggle-switch">
                    <input type="checkbox" checked={showTags} onChange={toggleShowTags} />
                    <span className="toggle-slider" />
                </label>
            </div>

            {/* Show Remote Branches toggle — switch on right */}
            <div className="settings-row">
                <div className="settings-row-label">
                    <div className="settings-row-title">{t(locale, "showRemoteBranches")}</div>
                    <div className="settings-row-desc">{t(locale, "showRemoteBranchesDesc")}</div>
                </div>
                <label className="toggle-switch">
                    <input type="checkbox" checked={showRemoteBranches} onChange={toggleShowRemoteBranches} />
                    <span className="toggle-slider" />
                </label>
            </div>

            {/* Show Graph toggle — switch on right */}
            <div className="settings-row">
                <div className="settings-row-label">
                    <div className="settings-row-title">{t(locale, "showGraph")}</div>
                    <div className="settings-row-desc">{t(locale, "showGraphDesc")}</div>
                </div>
                <label className="toggle-switch">
                    <input type="checkbox" checked={showGraph} onChange={toggleShowGraph} />
                    <span className="toggle-slider" />
                </label>
            </div>

            {/* Default Search Mode — radio on right */}
            <div className="settings-row" style={{ marginBottom: 20 }}>
                <div className="settings-row-label">
                    <div className="settings-row-title">{t(locale, "searchDefaultMode")}</div>
                    <div className="settings-row-desc">{t(locale, "searchDefaultModeDesc")}</div>
                </div>
                <div style={{ display: "flex", gap: 12, flexShrink: 0, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "12.5px" }}>
                        <input
                            type="radio"
                            name="searchDefaultMode"
                            checked={searchDefaultMode === "single"}
                            onChange={() => changeSearchDefaultMode("single")}
                            style={{ accentColor: "var(--vscode-focusBorder)", cursor: "pointer", margin: 0, outline: "none" }}
                        />
                        {t(locale, "searchModeSingle")}
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "12.5px" }}>
                        <input
                            type="radio"
                            name="searchDefaultMode"
                            checked={searchDefaultMode === "graph"}
                            onChange={() => changeSearchDefaultMode("graph")}
                            style={{ accentColor: "var(--vscode-focusBorder)", cursor: "pointer", margin: 0, outline: "none" }}
                        />
                        {t(locale, "searchModeGraph")}
                    </label>
                </div>
            </div>

            <div style={{ borderTop: "1px solid var(--vscode-panel-border)", margin: "12px 0 16px" }} />

            {/* Git Author — scope placed on the right of the header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--vscode-descriptionForeground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {t(locale, "gitAuthor")}
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
                        <input
                            type="radio"
                            name="scope"
                            checked={scope === "global"}
                            onChange={() => changeScope("global")}
                            style={{ accentColor: "var(--vscode-focusBorder)", cursor: "pointer", margin: 0, width: 13, height: 13, outline: "none" }}
                        />
                        {t(locale, "global")}
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
                        <input
                            type="radio"
                            name="scope"
                            checked={scope === "local"}
                            onChange={() => changeScope("local")}
                            style={{ accentColor: "var(--vscode-focusBorder)", cursor: "pointer", margin: 0, width: 13, height: 13, outline: "none" }}
                        />
                        {t(locale, "local")}
                    </label>
                </div>
            </div>

            {/* User Name */}
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>{t(locale, "userName")}</label>
                <input
                    type="text"
                    value={userName}
                    onChange={(e) => {
                        setUserName(e.target.value);
                        setNameChanged(true);
                    }}
                    onBlur={applyUserName}
                    onKeyDown={(e) => {
                        if (e.key === "Enter")
                            applyUserName();
                    }}
                    placeholder={t(locale, "userNamePlaceholder")}
                    style={{
                        width: "100%",
                        padding: "6px 8px",
                        background: "var(--vscode-input-background)",
                        color: "var(--vscode-input-foreground)",
                        border: "1px solid var(--vscode-input-border, rgba(128,128,128,0.25))",
                        borderRadius: 4,
                        fontSize: "13px",
                        fontFamily: "var(--vscode-font-family)",
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {/* User Email */}
            <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>{t(locale, "userEmail")}</label>
                <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => {
                        setUserEmail(e.target.value);
                        setEmailChanged(true);
                    }}
                    onBlur={applyUserEmail}
                    onKeyDown={(e) => {
                        if (e.key === "Enter")
                            applyUserEmail();
                    }}
                    placeholder="you@example.com"
                    style={{
                        width: "100%",
                        padding: "6px 8px",
                        background: "var(--vscode-input-background)",
                        color: "var(--vscode-input-foreground)",
                        border: "1px solid var(--vscode-input-border, rgba(128,128,128,0.25))",
                        borderRadius: 4,
                        fontSize: "13px",
                        fontFamily: "var(--vscode-font-family)",
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            <div style={{ borderTop: "1px solid var(--vscode-panel-border)", margin: "16px 0" }} />

            {/* Remotes */}
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--vscode-descriptionForeground)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                {t(locale, "remotes")}
            </div>

            {remotes.length === 0 && (
                <div style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px", marginBottom: 12 }}>{t(locale, "noRemotes")}</div>
            )}

            {remotes.map(r => (
                <div
                    key={r.name}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--vscode-panel-border)" }}
                >
                    <span style={{ fontWeight: 600, fontSize: "12.5px", minWidth: 80 }}>{r.name}</span>
                    <span style={{ flex: 1, fontSize: "12px", color: "var(--vscode-descriptionForeground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.url}
                    </span>
                    <button
                        title={`${t(locale, "removeRemote")} ${r.name}`}
                        onClick={() => removeRemote(r.name)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--vscode-descriptionForeground)",
                            cursor: "pointer",
                            fontSize: 14,
                            padding: "2px 6px",
                            borderRadius: 3,
                            lineHeight: 1,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--vscode-errorForeground)";
                            e.currentTarget.style.background = "var(--vscode-toolbar-hoverBackground)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--vscode-descriptionForeground)";
                            e.currentTarget.style.background = "none";
                        }}
                    >
                        ✕
                    </button>
                </div>
            ))}

            <button
                onClick={addRemote}
                style={{
                    marginTop: 10,
                    padding: "5px 14px",
                    background: "var(--vscode-button-secondaryBackground)",
                    color: "var(--vscode-button-secondaryForeground)",
                    border: "1px solid var(--vscode-button-secondaryBorder, var(--vscode-panel-border))",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: "12px",
                    fontFamily: "var(--vscode-font-family)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--vscode-button-secondaryHoverBackground)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--vscode-button-secondaryBackground)"; }}
            >
                {t(locale, "addRemote")}
            </button>
        </div>
    );
}
