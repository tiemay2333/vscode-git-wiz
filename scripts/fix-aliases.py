import os
import re
import sys

def fix_aliases_in_out(out_dir):
    # Matches require("@/...") or from "@/..."
    # Pattern for require
    req_pattern = re.compile(r'require\(["\']@/([^"\']+)["\']\)')
    # Pattern for ESM-like imports if they exist in output (unlikely for commonjs but safe)
    imp_pattern = re.compile(r'from\s+["\']@/([^"\']+)["\']')

    for root, dirs, files in os.walk(out_dir):
        for file in files:
            if file.endswith('.js'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                def replacer(match):
                    target_rel_to_src = match.group(1)
                    # out_dir corresponds to src/
                    target_abs = os.path.normpath(os.path.join(out_dir, target_rel_to_src))
                    file_dir = os.path.dirname(filepath)
                    rel_path = os.path.relpath(target_abs, file_dir)
                    
                    if not rel_path.startswith('.'):
                        rel_path = './' + rel_path
                    
                    # Determine if it was require() or from ""
                    if match.group(0).startswith('require'):
                        return f'require("{rel_path}")'
                    else:
                        return f'from "{rel_path}"'

                new_content = req_pattern.sub(replacer, content)
                new_content = imp_pattern.sub(replacer, new_content)
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Fixed aliases in: {filepath}")

if __name__ == "__main__":
    out_directory = sys.argv[1] if len(sys.argv) > 1 else 'out'
    fix_aliases_in_out(out_directory)
