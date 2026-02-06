
import os
import re

def find_toast_usages(root_dir):
    toast_pattern = re.compile(r'toast(?:\.(success|error|info|warning|loading|custom|message))?\s*\(([\s\S]*?)\)', re.MULTILINE)
    
    usage_list = []
    
    for subdir, dirs, files in os.walk(root_dir):
        # Skip node_modules and .git
        if 'node_modules' in subdir or '.git' in subdir:
            continue
            
        for file in files:
            if not file.endswith(('.tsx', '.ts', '.js', '.jsx')):
                continue
                
            filepath = os.path.join(subdir, file)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                matches = toast_pattern.finditer(content)
                
                for match in matches:
                    start_index = match.start()
                    # Calculate line number
                    line_number = content.count('\n', 0, start_index) + 1
                    
                    method = match.group(1) if match.group(1) else 'default'
                    args = match.group(2)
                    
                    # Clean up args a bit to make it readable (take first line or so if multiline)
                    # We want to match balanced parenthesis for the arguments ideally, but regex is weak for that.
                    # We will take the captured group up to the first unbalanced closing parenthesis?
                    # Actually valid TS code means matching parenthesis.
                    # As a heuristic, I'll take the string up to the first unrelated closing paren
                    # But the regex `([\s\S]*?)` is non-greedy.
                    # Let's just blindly take the match and try to extract the first string argument if possible.
                    
                    # Extract string literals
                    strings = re.findall(r"['\"`].*?['\"`]", args)
                    message = strings[0] if strings else "Dynamic/Complex"
                    
                    # better approach for full arguments capture: use a simple counter
                    balance = 0
                    full_args = ""
                    params_start_idx = match.start(2)
                    
                    for char in content[params_start_idx:]:
                        if char == '(':
                            balance += 1
                        elif char == ')':
                            balance -= 1
                        
                        if balance < 0:
                            break
                        full_args += char
                        
                    # Clean up whitespace
                    full_args = " ".join(full_args.split())
                    if len(full_args) > 100:
                         full_args = full_args[:100] + "..."

                    usage_list.append({
                        'file': filepath,
                        'line': line_number,
                        'type': method,
                        'args': full_args
                    })
                    
            except Exception as e:
                print(f"Error reading {filepath}: {e}")

    return usage_list

if __name__ == "__main__":
    usages = find_toast_usages('/Users/nada/Desktop/Momentum Workspace/mutual-tasks-pwa-webapp/src')
    print(f"Found {len(usages)} toast instances.")
    for u in usages:
        print(f"[{u['type'].upper()}] {u['file']}:{u['line']} - {u['args']}")
