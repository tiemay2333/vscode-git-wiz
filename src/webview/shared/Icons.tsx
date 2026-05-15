import React from "react";

interface IconProps {
    className?: string;
    style?: React.CSSProperties;
}

// ── BranchPanel Icons ──────────────────────────────────────────────────────

export function IconChevronRight({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

export function IconChevronDown({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

export function IconStar({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

export function IconFolder({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" strokeWidth="0">
            <path d="M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h6l2 2h8q.825 0 1.413.588T22 8v10q0 .825-.587 1.413T20 20z" />
        </svg>
    );
}

export function IconTag({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="3" />
        </svg>
    );
}

export function IconBranch({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 01-9 9" />
        </svg>
    );
}

// ── Search & Warning Icons ─────────────────────────────────────────────────

export function IconSearch({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="5" />
            <line x1="11" y1="11" x2="15" y2="15" />
        </svg>
    );
}

export function IconWarning({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 16.3L14.89 3.58a3.43 3.43 0 0 0-5.78 0L1.44 16.3a3 3 0 0 0-.05 3A3.37 3.37 0 0 0 4.33 21h15.34a3.37 3.37 0 0 0 2.94-1.66a3 3 0 0 0-.05-3.04M12 17a1 1 0 1 1 1-1a1 1 0 0 1-1 1m1-4a1 1 0 0 1-2 0V9a1 1 0 0 1 2 0Z" />
        </svg>
    );
}

// ── View Toggle Icons (simple, 16x16) ──────────────────────────────────────

export function IconList({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M2 3h12v1H2V3zm0 4h12v1H2V7zm12 4H2v1h12v-1z" />
        </svg>
    );
}

export function IconTree({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M1 2v3h1V2h12v12h-3v1h4V1H1v1zm12 12V5H5v9h8zm-1-1H6V6h6v7zM1 9h3V6H1v3zm1 4h3v-3H1v3z" />
        </svg>
    );
}

// ── View Toggle Icons (detailed, 36x36) ────────────────────────────────────

export function IconListView({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 36 36" fill="currentColor">
            <path d="M2 8h2v2H2z" />
            <path d="M7 10h24a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2" />
            <path d="M2 14h2v2H2z" />
            <path d="M31 14H7a1 1 0 0 0 0 2h24a1 1 0 0 0 0-2" />
            <path d="M2 20h2v2H2z" />
            <path d="M31 20H7a1 1 0 0 0 0 2h24a1 1 0 0 0 0-2" />
            <path d="M2 26h2v2H2z" />
            <path d="M31 26H7a1 1 0 0 0 0 2h24a1 1 0 0 0 0-2" />
        </svg>
    );
}

export function IconTreeView({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 36 36" fill="currentColor">
            <rect width="6" height="6" x="10" y="26" rx="1" ry="1" />
            <path d="M15 16h-4a1 1 0 0 0-1 1v1.2H5.8V12H7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1.2v17.8H11a.8.8 0 1 0 0-1.6H5.8v-8.4H10V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1" />
            <path d="M33 8H10v2h23a1 1 0 0 0 0-2" />
            <path d="M33 18H18v2h15a1 1 0 0 0 0-2" />
            <path d="M33 28H18v2h15a1 1 0 0 0 0-2" />
        </svg>
    );
}

// ── File Tree Icons ────────────────────────────────────────────────────────

export function IconChevronSmall({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4L10 8L6 12" />
        </svg>
    );
}

export function IconFolderSmall({ className, style }: IconProps) {
    return (
        <svg className={className} style={style} width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M7.71 4H14.5L15 4.5v9l-.5.5H1.5l-.5-.5v-10l.5-.5h5.5l1.21 1z" />
        </svg>
    );
}
