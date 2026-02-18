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
    try:
        if isinstance(s, (int, float)): return float(s)
        return float(s.replace(',', '').replace('"', '').strip())
    except:
        return 0.0

def read_full_csv(filepath):
    data = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # Find year header
            header = []
            start_row_idx = 0
            for i, row in enumerate(reader):
                if not row: continue
                # Identify header row with years
                if len(row) > 3 and "2021" in row[3] and "2025" in row[7]:
                    header = row
                    start_row_idx = i
                    break
            
            # Reset file pointer to read again from start or just continue if logical
            # But reader is iter, so let's re-open effectively or just process list
            f.seek(0)
            reader = csv.reader(f)
            rows = list(reader)
            
            # Extract data rows after header
            for i in range(start_row_idx + 1, len(rows)):
                row = rows[i]
                if not row or len(row) < 2: continue
                label = row[0].strip()
                if not label: continue
                
                # Check if it has values
                values = []
                has_val = False
                for x in row[3:8]: # 2021-2025 cols
                    val = parse_num(x)
                    if x and x.strip(): has_val = True
                    values.append(val)
                
                if has_val:
                    data.append({"label": label, "values": values})
                    
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return data

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    files = {
        "kqkd": os.path.join(data_dir, "kqkd.csv"),
        "cdkt": os.path.join(data_dir, "cdkt.csv"),
        "lctt": os.path.join(data_dir, "lctt.csv")
    }

    full_data = {
        "years": [2021, 2022, 2023, 2024, 2025],
        "statements": {
            "Income Statement (KQKD)": read_full_csv(files["kqkd"]),
            "Balance Sheet (CDKT)": read_full_csv(files["cdkt"]),
            "Cash Flow (LCTT)": read_full_csv(files["lctt"])
        }
    }
    
    # Also keep the simplified model data for the valuation chart
    # Re-using previous logic quickly to ensure we don't break the model
    # (Simplified for brevity, assuming previous JSON exists or we just write a new file for full data)
    
    out_path = os.path.join(output_dir, "full_financials.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(full_data, f, ensure_ascii=False, indent=2)
    print(f"Full data extracted to {out_path}")

if __name__ == "__main__":
    main()
