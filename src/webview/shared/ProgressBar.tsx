import React from "react";

interface ProgressBarProps {
    visible: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ visible }) => {
    if (!visible) {
        return null;
    }

    return (
        <div className="progress-bar-container">
            <div className="progress-bar-line"></div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .progress-bar-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    z-index: 9999;
                    pointer-events: none;
                }
                .progress-bar-line {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 10%;
                    background-color: var(--vscode-progressBar-background, #0e70c0);
                    animation: progress-loading 1.5s infinite ease-in-out;
                }
                @keyframes progress-loading {
                    0% {
                        left: -10%;
                    }
                    100% {
                        left: 100%;
                    }
                }
            `,
            }}
            />
        </div>
    );
};
