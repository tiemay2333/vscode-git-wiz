import { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphView } from './graph/GraphView';
import { CommitDetailsView, CommitDetailsData } from './commitDetails/CommitDetailsView';
import { BranchPanel, Branch } from './branches/BranchPanel';
import { GitCommit } from './types';
import { vscode } from './vscodeApi';

declare global {
    interface Window {
        __VIEW__: 'graph' | 'commitDetails' | 'branches';
        __COMMITS__: GitCommit[];
        __HAS_MORE__: boolean;
        __FILTER_BRANCH__: string | null;
        __CURRENT_BRANCH__: string | null;
        __COMMIT_DETAILS__: CommitDetailsData;
        __BRANCHES__: Branch[];
        __FILES_VIEW_MODE__?: 'list' | 'tree';
        __COMMIT_DETAILS_VIEW_MODE__?: 'list' | 'tree';
    }
}

function GraphLayout() {
    const saved = vscode.getState<{ leftWidth?: number }>();
    const [leftWidth, setLeftWidth] = useState(saved?.leftWidth ?? 250);
    const widthRef = useRef(leftWidth);
    useEffect(() => {
        widthRef.current = leftWidth;
    }, [leftWidth]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = widthRef.current;

        function onMouseMove(e: MouseEvent) {
            setLeftWidth(Math.max(150, Math.min(500, startWidth + e.clientX - startX)));
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            vscode.setState({ leftWidth: widthRef.current });
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const startX = e.touches[0].clientX;
        const startWidth = widthRef.current;

        function onTouchMove(e: TouchEvent) {
            if (e.touches.length !== 1) return;
            setLeftWidth(Math.max(150, Math.min(500, startWidth + e.touches[0].clientX - startX)));
        }

        function onTouchEnd() {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            vscode.setState({ leftWidth: widthRef.current });
        }

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }, []);

    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
            <div style={{ width: leftWidth, flexShrink: 0, borderRight: '1px solid var(--vscode-panel-border)', overflowY: 'auto' }}>
                <BranchPanel branches={window.__BRANCHES__ || []} />
            </div>
            <div
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                style={{
                    width: 4,
                    flexShrink: 0,
                    cursor: 'col-resize',
                    background: 'transparent',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-focusBorder)';
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
            />
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <GraphView
                    commits={window.__COMMITS__}
                    hasMore={window.__HAS_MORE__}
                    filterBranch={window.__FILTER_BRANCH__}
                    currentBranch={window.__CURRENT_BRANCH__}
                />
            </div>
        </div>
    );
}

const root = document.getElementById('root')!;
const r = createRoot(root);

if (window.__VIEW__ === 'graph') {
    r.render(<GraphLayout />);
} else if (window.__VIEW__ === 'commitDetails') {
    r.render(<CommitDetailsView data={window.__COMMIT_DETAILS__} />);
} else if (window.__VIEW__ === 'branches') {
    r.render(<BranchPanel branches={window.__BRANCHES__} />);
}
