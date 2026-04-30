import { GitCommit } from '../types';

export interface GraphNode {
    commit: GitCommit;
    x: number;
    color: number;
    lines: Array<{
        x1: number;
        y1: number; // 0 = top, 1 = center, 2 = bottom
        x2: number;
        y2: number;
        color: number;
    }>;
    maxTrack: number;
}

type Track = { hash: string; color: number } | null;

export function computeGraphLayout(commits: GitCommit[]): GraphNode[] {
    const activeTracks: Track[] = [];
    const nodes: GraphNode[] = [];
    let nextColor = 0;

    const findAvailableTrack = () => {
        const idx = activeTracks.findIndex((t) => t === null);
        if (idx !== -1) return idx;
        activeTracks.push(null);
        return activeTracks.length - 1;
    };

    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        
        // Find all tracks from previous row targeting this commit
        const cTopIndices: number[] = [];
        for (let t = 0; t < activeTracks.length; t++) {
            if (activeTracks[t]?.hash === commit.hash) {
                cTopIndices.push(t);
            }
        }

        let cIdx: number;
        let commitColor: number;

        if (cTopIndices.length === 0) {
            cIdx = findAvailableTrack();
            commitColor = nextColor++;
        } else {
            cIdx = Math.min(...cTopIndices);
            commitColor = activeTracks[cIdx]!.color;
        }

        // Write lines
        const lines: GraphNode['lines'] = [];

        // Tracks passing through
        for (let t = 0; t < activeTracks.length; t++) {
            if (activeTracks[t] && !cTopIndices.includes(t)) {
                lines.push({
                    x1: t, y1: 0, x2: t, y2: 2, color: activeTracks[t]!.color
                });
            }
        }

        // Lines from top to center (merges or main line)
        for (const topIdx of cTopIndices) {
            lines.push({
                x1: topIdx, y1: 0, x2: cIdx, y2: 1, color: activeTracks[topIdx]!.color
            });
            if (topIdx !== cIdx) {
                activeTracks[topIdx] = null; // free merged tracks
            }
        }

        // Outgoing to parents
        if (commit.parents.length > 0) {
            activeTracks[cIdx] = { hash: commit.parents[0], color: commitColor };
            lines.push({
                x1: cIdx, y1: 1, x2: cIdx, y2: 2, color: commitColor
            });

            for (let p = 1; p < commit.parents.length; p++) {
                const pt = findAvailableTrack();
                const pColor = nextColor++;
                activeTracks[pt] = { hash: commit.parents[p], color: pColor };
                lines.push({
                    x1: cIdx, y1: 1, x2: pt, y2: 2, color: pColor
                });
            }
        } else {
            activeTracks[cIdx] = null;
        }

        // Find maxTrack to size the SVG horizontally
        let maxTrack = 0;
        for (const line of lines) {
            maxTrack = Math.max(maxTrack, line.x1, line.x2);
        }

        nodes.push({
            commit,
            x: cIdx,
            color: commitColor,
            lines,
            maxTrack
        });
    }

    return nodes;
}
