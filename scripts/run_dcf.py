import csv
import os

# --- DCF Model Class (No Numpy) ---
class DCFModel:
    def __init__(self, company_name="Company"):
        self.company_name = company_name
        self.historical = {}
        self.assumptions = {}
        self.wacc_components = {}
        self.valuation = {}
        self.projections = {}

    def set_historical(self, years, revenue, ebitda, capex, nwc):
        self.historical = {
            "years": years,
            "revenue": revenue,
            "ebitda": ebitda,
            "capex": capex,
            "nwc": nwc,
            "ebitda_margin": [e/r if r else 0 for e, r in zip(ebitda, revenue)],
            "capex_percent": [c/r if r else 0 for c, r in zip(capex, revenue)],
            "nwc_percent": [n/r if r else 0 for n, r in zip(nwc, revenue)]
        }

    def set_assumptions(self, proj_years=5, rev_growth=None, ebitda_margin=None, 
                       tax_rate=0.20, capex_pct=None, nwc_pct=None, terminal_growth=0.03):
        if rev_growth is None: rev_growth = [0.10] * proj_years
        if ebitda_margin is None:
            # Avg margin
            avg = sum(self.historical["ebitda_margin"]) / len(self.historical["ebitda_margin"])
            ebitda_margin = [avg] * proj_years
        if capex_pct is None:
            # Avg capex
            avg = sum(self.historical["capex_percent"]) / len(self.historical["capex_percent"])
            capex_pct = [avg] * proj_years
        if nwc_pct is None:
            # Avg nwc
            avg = sum(self.historical["nwc_percent"]) / len(self.historical["nwc_percent"])
            nwc_pct = [avg] * proj_years

        self.assumptions = {
            "years": proj_years,
            "rev_growth": rev_growth,
            "ebitda_margin": ebitda_margin,
            "tax_rate": tax_rate,
            "capex_pct": capex_pct,
            "nwc_pct": nwc_pct,
            "terminal_growth": terminal_growth
        }

    def calc_wacc(self, rf, beta, rm, cost_debt, d_e, tax_rate=None):
        if tax_rate is None: tax_rate = self.assumptions.get("tax_rate", 0.20)
        ke = rf + beta * rm
        we = 1 / (1 + d_e)
        wd = d_e / (1 + d_e)
        wacc = we * ke + wd * cost_debt * (1 - tax_rate)
        self.wacc_components = {"wacc": wacc, "ke": ke, "kd": cost_debt, "we": we, "wd": wd}
        return wacc

    def project(self):
        years = self.assumptions["years"]
        base_rev = self.historical["revenue"][-1]
        base_nwc = self.historical["nwc"][-1]
        
        proj = {"year": [], "revenue": [], "ebitda": [], "ebit": [], "tax": [], 
                "nopat": [], "capex": [], "nwc_change": [], "fcf": []}
        
        prev_rev = base_rev
        prev_nwc = base_nwc
        
        for i in range(years):
            rev = prev_rev * (1 + self.assumptions["rev_growth"][i])
            ebitda = rev * self.assumptions["ebitda_margin"][i]
            # Assume Depr = Capex for simplicity in maintenance mode, or use Capex %
            depr = rev * self.assumptions["capex_pct"][i] 
            ebit = ebitda - depr
            tax = ebit * self.assumptions["tax_rate"]
            nopat = ebit - tax
            capex = rev * self.assumptions["capex_pct"][i]
            
            curr_nwc = rev * self.assumptions["nwc_pct"][i]
            nwc_chg = curr_nwc - prev_nwc
            
            fcf = nopat + depr - capex - nwc_chg
            
            proj["year"].append(i+1)
            proj["revenue"].append(rev)
            proj["ebitda"].append(ebitda)
            proj["fcf"].append(fcf)
            
            prev_rev = rev
            prev_nwc = curr_nwc
            
        self.projections = proj
        return proj

    def calc_value(self):
        if not self.projections: self.project()
        wacc = self.wacc_components["wacc"]
        g = self.assumptions["terminal_growth"]
        
        # PV of FCF
        fcf = self.projections["fcf"]
        pv_fcf = sum([f / ((1+wacc)**(i+1)) for i, f in enumerate(fcf)])
        
        # Terminal Value
        if wacc <= g: # Safety check
            term_val = 0
            pv_term = 0
        else:
            term_fcf = fcf[-1] * (1+g)
            term_val = term_fcf / (wacc - g)
            pv_term = term_val / ((1+wacc)**self.assumptions["years"])
        
        ev = pv_fcf + pv_term
        self.valuation = {"ev": ev, "pv_fcf": pv_fcf, "pv_term": pv_term, "term_val": term_val}
        return ev

# --- Main Logic ---

def parse_num(s):
    if not s: return 0.0
    try:
        if isinstance(s, (int, float)): return float(s)
        return float(s.replace(',', '').replace('"', '').strip())
    except:
        return 0.0

def read_data():
    # File paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base = os.path.dirname(script_dir) # Go up one level to project root
    data_dir = os.path.join(base, "data")
    
    files = {
        "kqkd": os.path.join(data_dir, "kqkd.csv"),
        "cdkt": os.path.join(data_dir, "cdkt.csv"),
        "lctt": os.path.join(data_dir, "lctt.csv")
    }
    
    data = {}
    
    # Read KQKD
    with open(files["kqkd"], 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if not row: continue
            if "3. Doanh thu thuần" in row[0]:
                data["rev"] = [parse_num(x) for x in row[3:8]] # 2021-2025
            if "15. Tổng lợi nhuận kế toán trước thuế" in row[0]:
                data["ebt"] = [parse_num(x) for x in row[3:8]]
            # Fuzzy match for interest
            if "Chi phí lãi vay" in row[0] and "Trong đó" in row[0]: 
                data["int"] = [parse_num(x) for x in row[3:8]]

    # Read LCTT
    with open(files["lctt"], 'r', encoding='utf-8') as f: 
        reader = csv.reader(f)
        for row in reader:
            if not row: continue
            if "Khấu hao TSCĐ" in row[0]:
                data["depr"] = [parse_num(x) for x in row[3:8]]
            if "1. Tiền chi để mua sắm" in row[0]:
                data["capex"] = [abs(parse_num(x)) for x in row[3:8]] 

    # Read CDKT
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
    
    return data

if __name__ == "__main__":
    data = read_data()
    
    years = [2021, 2022, 2023, 2024, 2025]
    
    # Prepare Inputs
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
        
    # Init Model
    model = DCFModel("Nhựa Bình Minh (BMP)")
    model.set_historical(years, revenue, ebitda, capex, nwc)
    
    # Assumptions
    model.set_assumptions(
        proj_years=5,
        rev_growth=[0.05]*5, 
        tax_rate=0.20,
        terminal_growth=0.03
    )
    
    # WACC
    model.calc_wacc(rf=0.03, beta=0.8, rm=0.10, cost_debt=0.06, d_e=0.0)
    
    # Calculate
    ev = model.calc_value()
    
    # Equity Value
    total_cash = c[-1] + si[-1]
    debt = 0 
    eq_val = ev - debt + total_cash
    shares = 81.86 
    price = eq_val / shares if shares else 0
    
    print("-" * 50)
    print(f"KẾT QUẢ ĐỊNH GIÁ DCF: {model.company_name}")
    print("-" * 50)
    print(f"Giả định:")
    print(f"  - Tăng trưởng doanh thu: 5%/năm")
    print(f"  - WACC: {model.wacc_components['wacc']*100:.1f}%")
    print(f"  - Tăng trưởng dài hạn (Terminal Growth): 3.0%")
    print("-" * 50)
    print(f"Giá trị doanh nghiệp (Enterprise Value): {ev:,.0f} tỷ VND")
    print(f"Cộng: Tiền mặt & ĐTTC (2025): {total_cash:,.0f} tỷ VND")
    print(f"Giá trị vốn chủ sở hữu (Equity Value): {eq_val:,.0f} tỷ VND")
    print("-" * 50)
    print(f"GIÁ MỤC TIÊU CỔ PHIẾU: {price*1000:,.0f} VND/CP")
    print("-" * 50)
    
    # Sensitivity Table
    print("\n[PHÂN TÍCH ĐỘ NHẠY]")
    print(f"Giá mục tiêu (VND) theo thay đổi WACC (hàng) và Tốc độ tăng trưởng dài hạn (cột)")
    print("      |   g=2.0%      g=3.0%      g=4.0%")
    print("------+-----------------------------------")
    
    wacc_original = model.wacc_components["wacc"]
    
    for w_adj in [-0.01, 0, 0.01]: # +/- 1% WACC
        w = wacc_original + w_adj
        row_vals = []
        for g in [0.02, 0.03, 0.04]:
            model.wacc_components["wacc"] = w
            model.assumptions["terminal_growth"] = g
            v = model.calc_value()
            if v == 0: # Invalid WACC <= g
                 p = 0
            else:
                p = (v - debt + total_cash) / shares * 1000
            row_vals.append(p)
        print(f"W={w*100:.1f}% | {row_vals[0]:,.0f}   {row_vals[1]:,.0f}   {row_vals[2]:,.0f}")
