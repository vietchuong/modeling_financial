import csv
import json
import os

# Ensure directory exists
# Ensure directory exists
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
output_dir = os.path.join(base_dir, "web", "data")
os.makedirs(output_dir, exist_ok=True)

def parse_num(s):
    if not s: return 0.0
    s = str(s).strip()
    if not s: return 0.0
    try:
        # Check standard float
        return float(s)
    except:
        try:
            # Check VND format 1,234
            return float(s.replace(',', '').replace('"', '').strip())
        except:
            return 0.0

def process_file_rows(file_path):
    rows_out = []
    print(f"Reading {file_path}")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return rows_out
    
    try:
        # Try both utf-8 and utf-8-sig just in case
        encodings = ['utf-8-sig', 'utf-8']
        
        content = []
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = list(csv.reader(f))
                if content: break
            except: continue
        
        all_rows = content
        print(f"Read {len(all_rows)} rows")
        
        # Find header row with 2021..2025
        start_idx = 0
        for i, r in enumerate(all_rows):
            if len(r) > 3 and '2021' in str(r) and '2025' in str(r):
                start_idx = i + 1
                break
        
        for i in range(start_idx, len(all_rows)):
            row = all_rows[i]
            if not row or len(row) < 2: continue
            
            label = row[0].strip()
            # Basic filtering
            if not label or label.startswith("Giai đoạn") or label.startswith("Hợp nhất"):
                continue

            vals = []
            has_data = False
            for col_idx in range(3, 8):
                if col_idx < len(row):
                    val_str = row[col_idx]
                    val = parse_num(val_str)
                    vals.append(val)
                    if val != 0 : has_data = True
                else:
                    vals.append(0.0)
            
            if has_data or (label and label[0].isdigit()):
                rows_out.append({"label": label, "values": vals})
                
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        
    return rows_out

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    # Re-verify filenames from a direct dir listing if previous failed?
    # Assuming correct for now based on previous steps
    files = {
        "kqkd": os.path.join(data_dir, "kqkd.csv"),
        "cdkt": os.path.join(data_dir, "cdkt.csv"),
        "lctt": os.path.join(data_dir, "lctt.csv")
    }
    
    full_data = {
        "years": [2021, 2022, 2023, 2024, 2025],
        "statements": {
            "Income Statement": process_file_rows(files["kqkd"]),
            "Balance Sheet": process_file_rows(files["cdkt"]),
            "Cash Flow": process_file_rows(files["lctt"])
        }
    }
    
    js_content = f"const FULL_FINANCIALS = {json.dumps(full_data, ensure_ascii=False, indent=2)};"
    
    out_path = os.path.join(output_dir, "full_financials.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print(f"Full data extracted to {out_path}")

if __name__ == "__main__":
    main()
