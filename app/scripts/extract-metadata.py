import os
import json
import re

TRANSFORMS_DIR = os.path.join(os.path.dirname(__file__), '../src/engine/transforms')
OUTPUT_FILE = '/tmp/node-catalog.json'

def parse_value(val):
    if not val:
        return None
    val = val.strip()
    if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
        return val[1:-1]
    if val == 'true':
        return True
    if val == 'false':
        return False
    try:
        if '.' in val:
            return float(val)
        return int(val)
    except ValueError:
        return val

def extract_options(param_text):
    options_match = re.search(r'options:\s*\[([\s\S]*?)\]', param_text)
    if not options_match:
        return None
    
    options_text = options_match.group(1)
    opts = []
    # Find all { label: '...', value: '...' } blocks
    opt_blocks = re.findall(r'\{([\s\S]*?)\}', options_text)
    for block in opt_blocks:
        label_match = re.search(r'label:\s*[\'"](.*?)[\'"]', block)
        value_match = re.search(r'value:\s*[\'"](.*?)[\'"]', block)
        if label_match and value_match:
            opts.append({"label": label_match.group(1), "value": value_match.group(1)})
    
    return opts if opts else None

def extract_metadata():
    if not os.path.exists(TRANSFORMS_DIR):
        print(f"Directory not found: {TRANSFORMS_DIR}")
        return

    files = [f for f in os.listdir(TRANSFORMS_DIR) if f.endswith('.js')]
    all_nodes = []

    for file in files:
        file_path = os.path.join(TRANSFORMS_DIR, file)
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find all registry.register({ ... }) blocks
        register_blocks = re.findall(r'registry\.register\(\{([\s\S]*?)\}\);', content)

        for block in register_blocks:
            node = {}
            
            # Simple fields
            id_match = re.search(r'id:\s*[\'"](.*?)[\'"]', block)
            name_match = re.search(r'name:\s*[\'"](.*?)[\'"]', block)
            category_match = re.search(r'category:\s*[\'"](.*?)[\'"]', block)
            desc_match = re.search(r'description:\s*[\'"](.*?)[\'"]', block)
            icon_match = re.search(r'icon:\s*[\'"](.*?)[\'"]', block)

            if id_match:
                node['id'] = id_match.group(1)
                node['name'] = name_match.group(1) if name_match else ""
                node['category'] = category_match.group(1) if category_match else ""
                node['description'] = desc_match.group(1) if desc_match else ""
                node['icon'] = icon_match.group(1) if icon_match else ""

                # Params
                params_match = re.search(r'params:\s*\[([\s\S]*?)\]', block)
                if params_match:
                    params_text = params_match.group(1)
                    param_objs = []
                    
                    # Split into individual param blocks by looking for }{ or },\n{ or start/end
                    # A safer way is to find all { ... } blocks that are not nested (params usually aren't nested objects in this app)
                    param_blocks = re.findall(r'\{([\s\S]*?)\}', params_text)
                    
                    for p_block in param_blocks:
                        p_name = re.search(r'name:\s*[\'"](.*?)[\'"]', p_block)
                        p_label = re.search(r'label:\s*[\'"](.*?)[\'"]', p_block)
                        p_type = re.search(r'type:\s*[\'"](.*?)[\'"]', p_block)
                        p_default = re.search(r'defaultValue:\s*([^,}]+)', p_block)
                        
                        if p_name:
                            p_data = {
                                "name": p_name.group(1),
                                "label": p_label.group(1) if p_label else "",
                                "type": p_type.group(1) if p_type else "text",
                            }
                            if p_default:
                                p_data["defaultValue"] = parse_value(p_default.group(1))
                            
                            opts = extract_options(p_block)
                            if opts:
                                p_data["options"] = opts
                            
                            param_objs.append(p_data)
                    
                    node['params'] = param_objs
                
                all_nodes.append(node)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_nodes, f, indent=2)
    
    print(f"Successfully extracted {len(all_nodes)} nodes to {OUTPUT_FILE}")

if __name__ == "__main__":
    extract_metadata()
