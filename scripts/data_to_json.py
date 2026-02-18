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

def read_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "web", "data")
    data_dir = os.path.join(base_dir, "data")
    files = {
        "kqkd": os.path.join(data_dir, "kqkd.csv"),
        "cdkt": os.path.join(data_dir, "cdkt.csv"),
        "lctt": os.path.join(data_dir, "lctt.csv")
    }
    
    data = {}
    
    # Read KQKD
    try:
        with open(files["kqkd"], 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row: continue
                if "3. Doanh thu thuần" in row[0]:
                    data["rev"] = [parse_num(x) for x in row[3:8]] # 2021-2025
                if "15. Tổng lợi nhuận kế toán trước thuế" in row[0]:
                    data["ebt"] = [parse_num(x) for x in row[3:8]]
                if "Chi phí lãi vay" in row[0] and "Trong đó" in row[0]: 
                    data["int"] = [parse_num(x) for x in row[3:8]]
    except Exception as e:
        print(f"Error reading KQKD: {e}")

    # Read LCTT
    try:
        with open(files["lctt"], 'r', encoding='utf-8') as f: 
            reader = csv.reader(f)
            for row in reader:
                if not row: continue
                if "Khấu hao TSCĐ" in row[0]:
                    data["depr"] = [parse_num(x) for x in row[3:8]]
                if "1. Tiền chi để mua sắm" in row[0]:
                    data["capex"] = [abs(parse_num(x)) for x in row[3:8]] 
    except Exception as e:
        print(f"Error reading LCTT: {e}")

    # Read CDKT
    try:
        with open(files["cdkt"], 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row: continue
                if "A. TÀI SẢN NGẮN HẠN" in row[0]:
                    data["ca"] = [parse_num(x) for x in row[3:8]]
                if "I. Tiền và các khoản tương đương tiền" in row[0]:
                    data["cash"] = [parse_num(x) for x in row[3:8]]
                if "II. Đầu tư tài chính ngắn hạn" in row[0]:
                    data["st_inv"] = [parse_num(x) for x in row[3:8]]
                if "I. Nợ ngắn hạn" in row[0]:
                    data["cl"] = [parse_num(x) for x in row[3:8]]
    except Exception as e:
        print(f"Error reading CDKT: {e}")
    
    return data

if __name__ == "__main__":
    data = read_data()
    years = [2021, 2022, 2023, 2024, 2025]
    
    ebt = data.get("ebt", [0]*5)
    interest = data.get("int", [0]*5)
    depr = data.get("depr", [0]*5)
    
    ebitda = []
    for i in range(5):
        val = ebt[i] + interest[i] + depr[i]
        ebitda.append(val)
        
    revenue = data.get("rev", [0]*5)
    capex = data.get("capex", [0]*5)
    
    # NWC
    ca = data.get("ca", [0]*5)
    c = data.get("cash", [0]*5)
    si = data.get("st_inv", [0]*5)
    cl = data.get("cl", [0]*5)
    
    nwc = []
    for i in range(5):
        val = (ca[i] - c[i] - si[i]) - cl[i]
        nwc.append(val)
        
    # Calculate percentages for assumptions
    # Avoid division by zero
    rev_safe = [r if r != 0 else 1 for r in revenue]
    
    ebitda_margins = [e/r for e, r in zip(ebitda, rev_safe)]
    avg_ebitda_margin = sum(ebitda_margins)/len(ebitda_margins) if ebitda_margins else 0.2
    
    capex_pcts = [c/r for c, r in zip(capex, rev_safe)]
    avg_capex_pct = sum(capex_pcts)/len(capex_pcts) if capex_pcts else 0.05
    
    nwc_pcts = [n/r for n, r in zip(nwc, rev_safe)]
    avg_nwc_pct = sum(nwc_pcts)/len(nwc_pcts) if nwc_pcts else 0.1
    
    # Last year cash
    cash_eq = c[-1] + si[-1] if c and si else 0

    output_data = {
        "company": "Nhựa Bình Minh (BMP)",
        "years": years,
        "shares_outstanding": 81.86,
        "historical": {
            "revenue": revenue,
            "ebitda": ebitda,
            "capex": capex,
            "nwc": nwc,
            "ebt": ebt,
            "interest": interest,
            "depr": depr,
            "cash_equivalents": cash_eq,
            "debt": 0
        },
        "assumptions": {
            "rev_growth": 0.05,
            "ebitda_margin": avg_ebitda_margin,
            "tax_rate": 0.20,
            "wacc": 0.11,
            "terminal_growth": 0.03,
            "capex_pct": avg_capex_pct,
            "nwc_pct": avg_nwc_pct
        }
    }

    out_path = os.path.join(output_dir, "financials.json")
    print(f"Writing to {out_path}...")
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print("Data successfully extracted to financials.json")
    except Exception as e:
        print(f"Error writing JSON: {e}")
