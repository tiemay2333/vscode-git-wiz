import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { vscode } from '../vscodeApi';

export interface Branch {
    name: string;
    fullName: string;
    isRemote: boolean;
    isHead: boolean;
    isTag: boolean;
}

type CtxMenu =
    | { kind: 'branch'; x: number; y: number; branch: Branch }
    | { kind: 'multi'; x: number; y: number; branches: Branch[] }
    | { kind: 'folder'; x: number; y: number; branches: Branch[]; folderKey: string };

interface Props {
    branches: Branch[];
}

type TreeNode = { type: 'branch'; branch: Branch } | { type: 'group'; key: string; name: string; children: TreeNode[] };

const IMPORTANT_BRANCHES = ['main', 'master', 'develop', 'dev', 'staging', 'production', 'prod'];

function getBranchPriority(name: string): number {
    const lowerName = name.toLowerCase();
    const idx = IMPORTANT_BRANCHES.indexOf(lowerName);
    return idx === -1 ? 999 : idx;
}

function buildTree(branches: Branch[], keyPrefix: string): TreeNode[] {
    const roots: { type: 'branch'; branch: Branch }[] = [];
    const groupMap = new Map<string, Branch[]>();

    for (const branch of branches) {
        const slash = branch.name.indexOf('/');
        if (slash === -1) {
            roots.push({ type: 'branch', branch });
        } else {
            const prefix = branch.name.slice(0, slash);
            const rest = branch.name.slice(slash + 1);
            if (!groupMap.has(prefix)) groupMap.set(prefix, []);
            groupMap.get(prefix)!.push({ ...branch, name: rest });
        }
    }

    const nodes: TreeNode[] = [];

    // Add folders (groups) first, sorted alphabetically
    const sortedPrefixes = Array.from(groupMap.keys()).sort((a, b) => a.localeCompare(b));
    for (const prefix of sortedPrefixes) {
        const children = groupMap.get(prefix)!;
        const key = `${keyPrefix}/${prefix}`;
        nodes.push({ type: 'group', key, name: prefix, children: buildTree(children, key) });
    }

    // Add individual branches second, sorted by priority then alphabetically
    roots.sort((a, b) => {
        const priorityA = getBranchPriority(a.branch.name);
        const priorityB = getBranchPriority(b.branch.name);
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return a.branch.name.localeCompare(b.branch.name);
    });
    nodes.push(...roots);

    return nodes;
}

function buildRemoteTree(branches: Branch[]): TreeNode[] {
    const remoteMap = new Map<string, Branch[]>();
    for (const b of branches) {
        const remote = b.fullName.split('/')[0];
        if (!remoteMap.has(remote)) remoteMap.set(remote, []);
        remoteMap.get(remote)!.push(b);
    }
    return [...remoteMap.entries()].map(([remote, children]) => ({
        type: 'group' as const,
        key: `remote/${remote}`,
        name: remote,
        children: buildTree(children, `remote/${remote}`),
    }));
}

function collectBranches(nodes: TreeNode[]): Branch[] {
    const result: Branch[] = [];
    for (const node of nodes) {
        if (node.type === 'branch') result.push(node.branch);
        else result.push(...collectBranches(node.children));
    }
    return result;
}

// Returns branches in visual display order, respecting collapsed groups
function flattenVisible(nodes: TreeNode[], collapsed: Set<string>): Branch[] {
    const result: Branch[] = [];
    for (const node of nodes) {
        if (node.type === 'branch') {
            result.push(node.branch);
        } else if (!collapsed.has(node.key)) {
            result.push(...flattenVisible(node.children, collapsed));
        }
    }
    return result;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IconChevronRight() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

function IconChevronDown() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

function IconStar() {
    return (
        <svg
            className="icon-star"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function IconFolder() {
    return (
        <svg className="icon-folder" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
    );
}

function IconTag() {
    return (
        <svg
            className="icon-tag"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
        </svg>
    );
}

function IconBranch() {
    return (
        <svg
            className="icon-branch"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 01-9 9" />
        </svg>
    );
}

function getBranchIcon(branch: Branch) {
    if (branch.isHead) return <IconTag />;
    if (branch.name === 'main' || branch.name === 'master') return <IconStar />;
    return <IconBranch />;
}

// ── Row components ───────────────────────────────────────────────────────────

function BranchRow({
    branch,
    depth,
    isSelected,
    isMultiSelected,
    isCtxOpen,
    onClick,
    onContextMenu,
}: {
    branch: Branch;
    depth: number;
    isSelected: boolean;
    isMultiSelected: boolean;
    isCtxOpen?: boolean;
    onClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) {
    return (
        <div
            className={`branch-row${isSelected ? ' selected' : ''}${isMultiSelected ? ' multi-selected' : ''}${branch.isHead ? ' is-head' : ''}${isCtxOpen ? ' context-open' : ''}`}
            style={{ paddingLeft: 20 + (depth * 18) + 18 }}
            onClick={onClick}
            onContextMenu={onContextMenu}
        >
            {getBranchIcon(branch)}
            <span className="row-label">{branch.name}</span>
        </div>
    );
}

function GroupRow({
    name,
    depth,
    isCollapsed,
    isCtxOpen,
    onToggle,
    onContextMenu,
}: {
    name: string;
    depth: number;
    isCollapsed: boolean;
    isCtxOpen?: boolean;
    onToggle: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}) {
    return (
        <div
            className={`group-row${isCtxOpen ? ' context-open' : ''}`}
            style={{ paddingLeft: 20 + (depth * 18) }}
            onClick={onToggle}
            onContextMenu={onContextMenu}
        >
            <span className="row-chevron">{isCollapsed ? <IconChevronRight /> : <IconChevronDown />}</span>
            <IconFolder />
            <span className="row-label">{name}</span>
        </div>
    );
}

function TreeNodes({
    nodes,
    depth,
    selected,
    multiSelected,
    collapsed,
    ctxMenu,
    isLocal,
    onSelect,
    onShiftClick,
    onCtrlClick,
    onContextMenu,
    onGroupContextMenu,
    onToggle,
}: {
    nodes: TreeNode[];
    depth: number;
    selected: string | null;
    multiSelected: Set<string>;
    collapsed: Set<string>;
    ctxMenu: CtxMenu | null;
    isLocal: boolean;
    onSelect: (branch: Branch) => void;
    onShiftClick: (branch: Branch) => void;
    onCtrlClick: (branch: Branch) => void;
    onContextMenu: (e: React.MouseEvent, branch: Branch) => void;
    onGroupContextMenu: (e: React.MouseEvent, branches: Branch[], groupKey: string) => void;
    onToggle: (key: string) => void;
}) {
    return (
        <>
            {nodes.map((node) => {
                if (node.type === 'branch') {
                    return (
                        <BranchRow
                            key={node.branch.fullName}
                            branch={node.branch}
                            depth={depth}
                            isSelected={selected === node.branch.fullName}
                            isMultiSelected={multiSelected.has(node.branch.fullName)}
                            isCtxOpen={ctxMenu?.kind === 'branch' && ctxMenu.branch.fullName === node.branch.fullName}
                            onClick={(e) => {
                                if (e.shiftKey) {
                                    e.preventDefault();
                                    onShiftClick(node.branch);
                                } else if (e.metaKey || e.ctrlKey) {
                                    e.stopPropagation();
                                    onCtrlClick(node.branch);
                                } else {
                                    onSelect(node.branch);
                                }
                            }}
                            onContextMenu={(e) => onContextMenu(e, node.branch)}
                        />
                    );
                }
                const isCollapsed = collapsed.has(node.key);
                const groupBranches = isLocal ? collectBranches(node.children) : [];
                return (
                    <React.Fragment key={node.key}>
                        <GroupRow
                            name={node.name}
                            depth={depth}
                            isCollapsed={isCollapsed}
                            isCtxOpen={ctxMenu?.kind === 'folder' && ctxMenu.folderKey === node.key}
                            onToggle={() => onToggle(node.key)}
                            onContextMenu={
                                isLocal && groupBranches.length > 0
                                    ? (e) => {
                                          e.preventDefault();
                                          onGroupContextMenu(e, groupBranches, node.key);
                                      }
                                    : undefined
                            }
                        />
                        {!isCollapsed && (
                            <TreeNodes
                                nodes={node.children}
                                depth={depth + 1}
                                selected={selected}
                                multiSelected={multiSelected}
                                collapsed={collapsed}
                                ctxMenu={ctxMenu}
                                isLocal={isLocal}
                                onSelect={onSelect}
                                onShiftClick={onShiftClick}
                                onCtrlClick={onCtrlClick}
                                onContextMenu={onContextMenu}
                                onGroupContextMenu={onGroupContextMenu}
                                onToggle={onToggle}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function BranchPanel({ branches: initialBranches }: Props) {
    const [branches, setBranches] = useState(initialBranches);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    
    const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
    const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
    const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [sectionsCollapsed, setSectionsCollapsed] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === 'replaceBranches') {
                const newBranches = msg.branches as Branch[];
                setBranches(newBranches);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const q = query.toLowerCase();
    const localBranches = branches.filter((b) => !b.isRemote && !b.isTag && (!q || b.name.toLowerCase().includes(q)));
    const remoteBranches = branches.filter((b) => b.isRemote && !b.isTag && (!q || b.name.toLowerCase().includes(q)));
    const tags = branches.filter((b) => b.isTag && (!q || b.name.toLowerCase().includes(q))).reverse();

    const localTree = buildTree(localBranches, 'local');
    const remoteTree = buildRemoteTree(remoteBranches);

    const handleSelect = useCallback(
        (branch: Branch) => {
            setCtxMenu(null);
            setMultiSelected(new Set());
            setRangeAnchor(branch.fullName);
            if (selected === branch.fullName) {
                setSelected(null);
                vscode.postMessage({ command: 'selectBranch', branchName: null });
            } else {
                setSelected(branch.fullName);
                vscode.postMessage({ command: 'selectBranch', branchName: branch.fullName });
            }
        },
        [selected],
    );

    const handleCtrlClick = useCallback((branch: Branch) => {
        if (branch.isRemote) return;
        setCtxMenu(null);
        setRangeAnchor(branch.fullName);
        setMultiSelected((prev) => {
            const next = new Set(prev);
            if (next.has(branch.fullName)) next.delete(branch.fullName);
            else next.add(branch.fullName);
            return next;
        });
    }, []);

    const handleShiftClick = useCallback(
        (branch: Branch) => {
            if (branch.isRemote) return;
            setCtxMenu(null);
            const flat = flattenVisible(localTree, collapsed);
            const anchorIdx = flat.findIndex((b) => b.fullName === rangeAnchor);
            const currentIdx = flat.findIndex((b) => b.fullName === branch.fullName);
            if (anchorIdx === -1 || currentIdx === -1) {
                handleCtrlClick(branch);
                return;
            }
            const min = Math.min(anchorIdx, currentIdx);
            const max = Math.max(anchorIdx, currentIdx);
            const next = new Set<string>();
            for (let i = min; i <= max; i++) {
                if (!flat[i].isRemote) next.add(flat[i].fullName);
            }
            setMultiSelected(next);
        },
        [rangeAnchor, localTree, collapsed, handleCtrlClick],
    );

    const handleContextMenu = useCallback(
        (e: React.MouseEvent, branch: Branch) => {
            e.preventDefault();
            if (!branch.isRemote && multiSelected.has(branch.fullName) && multiSelected.size > 1) {
                const selectedBranches = branches.filter((b) => multiSelected.has(b.fullName));
                setCtxMenu({ kind: 'multi', x: e.clientX, y: e.clientY, branches: selectedBranches });
            } else {
                setCtxMenu({ kind: 'branch', x: e.clientX, y: e.clientY, branch });
            }
        },
        [multiSelected, branches],
    );

    const handleGroupContextMenu = useCallback((e: React.MouseEvent, groupBranches: Branch[], groupKey: string) => {
        const deletable = groupBranches.filter((b) => !b.isRemote && !b.isHead);
        if (deletable.length === 0) return;
        setCtxMenu({ kind: 'folder', x: e.clientX, y: e.clientY, branches: deletable, folderKey: groupKey });
    }, []);

    const handleAction = useCallback((command: string, name: string) => {
        setCtxMenu(null);
        if (command === 'createBranchFromTag' || command === 'pushTag' || command === 'deleteTag') {
            vscode.postMessage({ command, tagName: name });
        } else {
            vscode.postMessage({ command, branchName: name });
        }
    }, []);

    const handleDeleteMultiple = useCallback((branchNames: string[]) => {
        setCtxMenu(null);
        setMultiSelected(new Set());
        vscode.postMessage({ command: 'deleteMultipleBranches', branchNames });
    }, []);

    const toggleGroup = useCallback((key: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const toggleSection = useCallback((key: string) => {
        setSectionsCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const ctxMenuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!ctxMenu || !ctxMenuRef.current) return;
        const el = ctxMenuRef.current;
        const rect = el.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let left = ctxMenu.x;
        let top = ctxMenu.y;

        if (left + rect.width > winW) {
            left = Math.max(4, winW - rect.width - 4);
        }
        if (top + rect.height > winH) {
            top = Math.max(4, winH - rect.height - 4);
        }

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.maxHeight = `${winH - 8}px`;
    }, [ctxMenu]);

    const localCollapsed = sectionsCollapsed.has('local');
    const remoteCollapsed = sectionsCollapsed.has('remote');
    const tagsCollapsed = sectionsCollapsed.has('tags');
    const isEmpty = localBranches.length === 0 && remoteBranches.length === 0 && tags.length === 0;

    return (
        <div
            style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
            onClick={() => {
                setCtxMenu(null);
            }}
        >
            <div className="search-wrap" style={{ flexShrink: 0, position: 'static' }}>
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search branches…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {localBranches.length > 0 && (
                <div className="section">
                    <div className="section-header" onClick={() => toggleSection('local')}>
                        <span className="section-chevron">
                            {localCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                        </span>
                        <span className="section-label">Local</span>
                    </div>
                    {!localCollapsed && (
                        <TreeNodes
                            nodes={localTree}
                            depth={0}
                            selected={selected}
                            multiSelected={multiSelected}
                            collapsed={collapsed}
                            ctxMenu={ctxMenu}
                            isLocal={true}
                            onSelect={(branch) => handleSelect(branch)}
                            onShiftClick={handleShiftClick}
                            onCtrlClick={handleCtrlClick}
                            onContextMenu={handleContextMenu}
                            onGroupContextMenu={handleGroupContextMenu}
                            onToggle={toggleGroup}
                        />
                    )}
                </div>
            )}

            {remoteBranches.length > 0 && (
                <div className="section">
                    <div className="section-header" onClick={() => toggleSection('remote')}>
                        <span className="section-chevron">
                            {remoteCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                        </span>
                        <span className="section-label">Remote</span>
                    </div>
                    {!remoteCollapsed && (
                        <TreeNodes
                            nodes={remoteTree}
                            depth={0}
                            selected={selected}
                            multiSelected={multiSelected}
                            collapsed={collapsed}
                            ctxMenu={ctxMenu}
                            isLocal={false}
                            onSelect={(branch) => handleSelect(branch)}
                            onShiftClick={handleShiftClick}
                            onCtrlClick={handleCtrlClick}
                            onContextMenu={handleContextMenu}
                            onGroupContextMenu={handleGroupContextMenu}
                            onToggle={toggleGroup}
                        />
                    )}
                </div>
            )}

            
            {tags.length > 0 && (
                <div className="section">
                    <div className="section-header" onClick={() => toggleSection('tags')}>
                        <span className="section-chevron">
                            {tagsCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                        </span>
                        <span className="section-label">Tags</span>
                    </div>
                    {!tagsCollapsed && tags.map(tag => (
                        <BranchRow
                            key={tag.fullName}
                            branch={tag}
                            depth={0}
                            isSelected={selected === tag.fullName}
                            isMultiSelected={false}
                            isCtxOpen={ctxMenu?.kind === 'branch' && ctxMenu.branch.fullName === tag.fullName}
                            onClick={() => handleSelect(tag)}
                            onContextMenu={(e) => handleContextMenu(e, tag)}
                        />
                    ))}
                </div>
            )}

            {isEmpty && <div className="empty">No branches match</div>}

            </div>

            {ctxMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setCtxMenu(null)} />
                    <div
                        ref={ctxMenuRef}
                        className="ctx-menu"
                        style={{ left: ctxMenu.x, top: ctxMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >

                        {ctxMenu.kind === 'branch' && (
                            <>
                                {ctxMenu.branch.isTag ? (
                                    <>
                                        <div
                                            className="ctx-item"
                                            onClick={() => handleAction('createBranchFromTag', ctxMenu.branch.name)}
                                        >
                                            Create Branch from Tag
                                        </div>
                                        <div
                                            className="ctx-item"
                                            onClick={() => handleAction('pushTag', ctxMenu.branch.name)}
                                        >
                                            Push Tag
                                        </div>
                                        <div className="ctx-sep" />
                                        <div
                                            className="ctx-item ctx-item-danger"
                                            onClick={() => handleAction('deleteTag', ctxMenu.branch.name)}
                                        >
                                            Delete Tag
                                        </div>
                                    </>
                                ) : ctxMenu.branch.isRemote ? (
                                    <>
                                        <div
                                            className="ctx-item"
                                            onClick={() => handleAction('checkoutBranch', ctxMenu.branch.fullName)}
                                        >
                                            Checkout
                                        </div>
                                        <div className="ctx-sep" />
                                        <div
                                            className="ctx-item ctx-item-danger"
                                            onClick={() => handleAction('deleteRemoteBranch', ctxMenu.branch.fullName)}
                                        >
                                            Delete Remote Branch
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            className="ctx-item"
                                            onClick={() => handleAction('checkoutBranch', ctxMenu.branch.fullName)}
                                        >
                                            Checkout
                                        </div>
                                        <div
                                            className="ctx-item"
                                            onClick={() => handleAction('deleteBranch', ctxMenu.branch.fullName)}
                                        >
                                            Delete
                                        </div>
                                        <div className="ctx-sep" />
                                        <div
                                            className="ctx-item"
                                            onClick={() => handleAction('createBranch', ctxMenu.branch.fullName)}
                                        >
                                            Create New Branch Here
                                        </div>
                                    </>
                                )}
                                <div className="ctx-sep" />
                                <div
                                    className="ctx-item"
                                    onClick={() => handleAction('rebaseBranch', ctxMenu.branch.fullName)}
                                >
                                    Rebase Current onto This
                                </div>
                                <div
                                    className="ctx-item"
                                    onClick={() => handleAction('mergeBranch', ctxMenu.branch.fullName)}
                                >
                                    Merge into Current
                                </div>
                            </>
                        )}

                        {ctxMenu.kind === 'multi' && (
                            <div
                                className="ctx-item ctx-item-danger"
                                onClick={() => handleDeleteMultiple(ctxMenu.branches.map((b) => b.fullName))}
                            >
                                Delete Selected ({ctxMenu.branches.length})
                            </div>
                        )}

                        {ctxMenu.kind === 'folder' && (
                            <div
                                className="ctx-item ctx-item-danger"
                                onClick={() => handleDeleteMultiple(ctxMenu.branches.map((b) => b.fullName))}
                            >
                                Delete All in Folder ({ctxMenu.branches.length})
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
