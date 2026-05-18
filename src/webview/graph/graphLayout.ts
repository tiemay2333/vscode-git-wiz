import type { GitCommit } from "@/git/utils/gitParser";
import { COLORS } from "./CommitRow";

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
    const headPath = new Set<string>();
    const commitMap = new Map(commits.map(c => [c.hash, c]));

    // Find the commit that represents HEAD
    const headCommit = commits.find(c => c.refs.some(r => r.match(/\bHEAD\b/)));
    if (headCommit) {
        let curr: GitCommit | undefined = headCommit;
        while (curr) {
            headPath.add(curr.hash);
            if (curr.parents.length > 0) {
                curr = commitMap.get(curr.parents[0]);
            }
            else {
                curr = undefined;
            }
        }
    }

    const activeTracks: Track[] = [];
    const nodes: GraphNode[] = [];
    let nextColor = 0;

    const findAvailableTrack = (isHeadPath: boolean) => {
        let startIdx = 0;
        if (headPath.size > 0 && !isHeadPath) {
            startIdx = 1;
        }

        while (activeTracks.length <= startIdx) {
            activeTracks.push(null);
        }

        for (let i = startIdx; i < activeTracks.length; i++) {
            if (activeTracks[i] === null) {
                return i;
            }
        }
        activeTracks.push(null);
        return activeTracks.length - 1;
    };

    const NUM_COLORS = COLORS.length;
    const getAvailableColor = (trackIdx: number) => {
        let proposedColor = nextColor;

        while (true) {
            let conflict = false;
            const proposedMod = proposedColor % NUM_COLORS;

            // Check all active tracks to avoid same colors if possible, but prioritize avoiding direct neighbors
            if (trackIdx > 0 && activeTracks[trackIdx - 1]) {
                if (activeTracks[trackIdx - 1]!.color % NUM_COLORS === proposedMod)
                    conflict = true;
            }
            if (trackIdx < activeTracks.length - 1 && activeTracks[trackIdx + 1]) {
                if (activeTracks[trackIdx + 1]!.color % NUM_COLORS === proposedMod)
                    conflict = true;
            }

            if (!conflict)
                break;
            proposedColor++;
            if (proposedColor - nextColor > NUM_COLORS) {
                // Fallback to nextColor if we can't find a perfect non-conflicting color (should be rare)
                proposedColor = nextColor;
                break;
            }
        }
        nextColor = proposedColor + 1;
        return proposedColor;
    };

    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const isHeadPath = headPath.has(commit.hash);

        // Find all tracks from previous row targeting this commit
        const cTopIndices: number[] = [];
        for (let t = 0; t < activeTracks.length; t++) {
            if (activeTracks[t]?.hash === commit.hash) {
                cTopIndices.push(t);
            }
        }

        let cIdx: number;
        let commitColor: number;

        if (isHeadPath) {
            cIdx = 0;
            if (cTopIndices.includes(0)) {
                commitColor = activeTracks[0]!.color;
            }
            else if (cTopIndices.length > 0) {
                commitColor = activeTracks[Math.min(...cTopIndices)]!.color;
            }
            else {
                commitColor = getAvailableColor(0);
            }
        }
        else if (cTopIndices.length === 0) {
            cIdx = findAvailableTrack(false);
            commitColor = getAvailableColor(cIdx);
        }
        else {
            cIdx = Math.min(...cTopIndices);
            commitColor = activeTracks[cIdx]!.color;
        }

        // Write lines
        const lines: GraphNode["lines"] = [];

        // Tracks passing through
        for (let t = 0; t < activeTracks.length; t++) {
            if (activeTracks[t] && !cTopIndices.includes(t)) {
                lines.push({
                    x1: t,
                    y1: 0,
                    x2: t,
                    y2: 2,
                    color: activeTracks[t]!.color,
                });
            }
        }

        // Lines from top to center (merges or main line)
        for (const topIdx of cTopIndices) {
            lines.push({
                x1: topIdx,
                y1: 0,
                x2: cIdx,
                y2: 1,
                color: activeTracks[topIdx]!.color,
            });
            if (topIdx !== cIdx) {
                activeTracks[topIdx] = null; // free merged tracks
            }
        }

        // Outgoing to parents
        if (commit.parents.length > 0) {
            const firstParentHash = commit.parents[0];

            activeTracks[cIdx] = { hash: firstParentHash, color: commitColor };
            lines.push({
                x1: cIdx,
                y1: 1,
                x2: cIdx,
                y2: 2,
                color: commitColor,
            });

            for (let p = 1; p < commit.parents.length; p++) {
                const parentHash = commit.parents[p];
                const pt = findAvailableTrack(false);
                const pColor = getAvailableColor(pt);
                activeTracks[pt] = { hash: parentHash, color: pColor };

                lines.push({
                    x1: cIdx,
                    y1: 1,
                    x2: pt,
                    y2: 2,
                    color: pColor,
                });
            }
        }
        else {
            activeTracks[cIdx] = null;
        }

        // Find maxTrack to size the SVG horizontally
        let maxTrack = cIdx;
        for (const line of lines) {
            maxTrack = Math.max(maxTrack, line.x1, line.x2);
        }

        nodes.push({
            commit,
            x: cIdx,
            color: commitColor,
            lines,
            maxTrack,
        });
    }

    return nodes;
}
