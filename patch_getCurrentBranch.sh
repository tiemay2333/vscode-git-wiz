const gitOps = fs.readFileSync('src/gitOperations.ts', 'utf8');
const newMethod = `
    async getCurrentBranch(): Promise<string | null> {
        return new Promise((resolve) => {
            const cwd = this.getCwd();
            if (!cwd) return resolve(null);
            cp.exec('git rev-parse --abbrev-ref HEAD', { cwd }, (err, stdout) => {
                if (err) return resolve(null);
                resolve(stdout.trim());
            });
        });
    }
`;
if (!gitOps.includes('getCurrentBranch')) {
    const lines = gitOps.split('\n');
    lines.splice(16, 0, newMethod);
    fs.writeFileSync('src/gitOperations.ts', lines.join('\n'));
}
