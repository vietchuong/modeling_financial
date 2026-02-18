"""
Unified Valuation Script for BMP (Nhựa Bình Minh)
Runs all 5 valuation methods:
  1. FCFF (DCF)
  2. FCFE
  3. P/E
  4. P/B
  5. DDM (Gordon Growth + Two-Stage + H-Model)

Data sourced from: data/cdkt.csv, data/kqkd.csv, data/lctt.csv
"""

import csv
import os
import sys

# Add parent dir to path so we can import from creating-financial-models
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
models_dir = os.path.join(project_root, "creating-financial-models")
sys.path.insert(0, models_dir)

from fcfe_model import FCFEModel
from relative_valuation import RelativeValuation
from ddm_model import DDMModel


# ============================================================
# DATA PARSING
# ============================================================

def parse_num(s):
    """Parse Vietnamese-formatted number strings."""
    if not s:
        return 0.0
    try:
        if isinstance(s, (int, float)):
            return float(s)
        return float(s.replace(',', '').replace('"', '').strip())
    except (ValueError, AttributeError):
        return 0.0


def read_all_data():
    """Read and parse all financial data from CSV files."""
    data_dir = os.path.join(project_root, "data")
    data = {}

    # --- KQKD (Income Statement) ---
    kqkd_path = os.path.join(data_dir, "kqkd.csv")
    with open(kqkd_path, 'r', encoding='utf-8') as f:
        for row in csv.reader(f):
            if not row:
                continue
            label = row[0].strip()
            if "3. Doanh thu thuần" in label:
                data["revenue"] = [parse_num(x) for x in row[3:8]]
            if "5. Lợi nhuận gộp" in label:
                data["gross_profit"] = [parse_num(x) for x in row[3:8]]
            if "7. Chi phí tài chính" in label:
                data["fin_cost"] = [parse_num(x) for x in row[3:8]]
            if "Chi phí lãi vay" in label and "Trong đó" in label:
                data["interest"] = [parse_num(x) for x in row[3:8]]
            if "15. Tổng lợi nhuận kế toán trước thuế" in label:
                data["ebt"] = [parse_num(x) for x in row[3:8]]
            if "18. Lợi nhuận sau thuế" in label:
                data["net_income"] = [parse_num(x) for x in row[3:8]]
            if "19. Lãi cơ bản trên cổ phiếu" in label:
                data["eps_raw"] = [parse_num(x) for x in row[3:8]]

    # --- CDKT (Balance Sheet) ---
    cdkt_path = os.path.join(data_dir, "cdkt.csv")
    with open(cdkt_path, 'r', encoding='utf-8') as f:
        for row in csv.reader(f):
            if not row:
                continue
            label = row[0].strip()
            if "A. TÀI SẢN NGẮN HẠN" in label:
                data["current_assets"] = [parse_num(x) for x in row[3:8]]
            if "I. Tiền và các khoản tương đương tiền" in label:
                data["cash"] = [parse_num(x) for x in row[3:8]]
            if "II. Đầu tư tài chính ngắn hạn" in label:
                data["st_investments"] = [parse_num(x) for x in row[3:8]]
            if "I. Nợ ngắn hạn" in label:
                data["current_liabilities"] = [parse_num(x) for x in row[3:8]]
            if "II. Nợ dài hạn" in label:
                data["lt_debt"] = [parse_num(x) for x in row[3:8]]
            if "A. NỢ PHẢI TRẢ" in label:
                data["total_debt"] = [parse_num(x) for x in row[3:8]]
            if "B. VỐN CHỦ SỞ HỮU" in label:
                data["equity"] = [parse_num(x) for x in row[3:8]]
            if "TỔNG CỘNG TÀI SẢN" in label:
                data["total_assets"] = [parse_num(x) for x in row[3:8]]

    # --- LCTT (Cash Flow Statement) ---
    lctt_path = os.path.join(data_dir, "lctt.csv")
    with open(lctt_path, 'r', encoding='utf-8') as f:
        for row in csv.reader(f):
            if not row:
                continue
            label = row[0].strip()
            if "Khấu hao TSCĐ" in label:
                data["depreciation"] = [parse_num(x) for x in row[3:8]]
            if "1. Tiền chi để mua sắm" in label:
                data["capex"] = [abs(parse_num(x)) for x in row[3:8]]
            if "Cổ tức, lợi nhuận đã trả" in label:
                data["dividends_paid"] = [abs(parse_num(x)) for x in row[3:8]]
            if "3. Tiền thu từ đi vay" in label:
                data["borrowing"] = [parse_num(x) for x in row[3:8]]
            if "4. Tiền trả nợ gốc vay" in label:
                data["debt_repaid"] = [abs(parse_num(x)) for x in row[3:8]]

    return data


# ============================================================
# CONSTANTS
# ============================================================

YEARS = [2021, 2022, 2023, 2024, 2025]
SHARES = 81.86  # Million shares outstanding

# WACC / Ke assumptions for Vietnam market
RF = 0.03       # Risk-free rate (VN gov bond ~3%)
BETA = 0.80     # BMP beta (relatively defensive)
MARKET_PREMIUM = 0.10  # Vietnam market premium
COST_OF_DEBT = 0.06
D_E_RATIO = 0.0  # BMP has almost no debt

# Peer multiples for Relative Valuation (Vietnam plastics industry)
PEER_MULTIPLES = {
    "NTP (Nhựa Tiền Phong)": {"pe": 10.0, "pb": 1.8, "ev_ebitda": 6.5},
    "BMP (Historical Avg)":  {"pe": 12.0, "pb": 2.5, "ev_ebitda": 7.0},
    "Industry Avg":          {"pe": 11.0, "pb": 2.0, "ev_ebitda": 7.5},
}


# ============================================================
# PRINT HELPERS
# ============================================================

def print_header(title):
    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)


def print_separator():
    print("-" * 65)


# ============================================================
# MAIN
# ============================================================

def main():
    data = read_all_data()

    print_header("TỔNG HỢP ĐỊNH GIÁ CỔ PHIẾU BMP (Nhựa Bình Minh)")
    print(f"  Số cổ phiếu lưu hành: {SHARES:.2f} triệu CP")
    print(f"  Dữ liệu: BCTC {YEARS[0]}-{YEARS[-1]}")
    print(f"  Rf = {RF:.0%}, Beta = {BETA}, Market Premium = {MARKET_PREMIUM:.0%}")

    # Derived data
    revenue = data.get("revenue", [0] * 5)
    net_income = data.get("net_income", [0] * 5)
    ebt = data.get("ebt", [0] * 5)
    interest = data.get("interest", [0] * 5)
    depreciation = data.get("depreciation", [0] * 5)
    capex = data.get("capex", [0] * 5)
    dividends_paid = data.get("dividends_paid", [0] * 5)
    cash = data.get("cash", [0] * 5)
    st_inv = data.get("st_investments", [0] * 5)
    equity = data.get("equity", [0] * 5)
    total_debt = data.get("total_debt", [0] * 5)
    current_assets = data.get("current_assets", [0] * 5)
    current_liabilities = data.get("current_liabilities", [0] * 5)
    borrowing = data.get("borrowing", [0] * 5)
    debt_repaid = data.get("debt_repaid", [0] * 5)
    eps_raw = data.get("eps_raw", [0] * 5)

    # EBITDA
    ebitda = [ebt[i] + interest[i] + depreciation[i] for i in range(5)]

    # NWC = (CA - Cash - ST Inv) - CL
    nwc = [(current_assets[i] - cash[i] - st_inv[i]) - current_liabilities[i]
           for i in range(5)]

    # Net borrowing
    net_borrowing = [borrowing[i] - debt_repaid[i] for i in range(5)]

    # Key metrics for latest year (2025)
    latest = -1
    eps_2025 = eps_raw[latest]  # Already in VND
    bvps_2025 = equity[latest] / SHARES * 1000  # tỷ → VND
    ebitda_2025 = ebitda[latest]
    net_debt_2025 = total_debt[latest] - cash[latest] - st_inv[latest]
    total_cash_2025 = cash[latest] + st_inv[latest]

    # ============================================================
    # 1. FCFF (DCF) — Existing method
    # ============================================================
    print_header("1. FCFF (Discounted Cash Flow)")

    # Simple inline DCF
    ke = RF + BETA * MARKET_PREMIUM
    wacc = ke  # BMP has ~0 debt, so WACC ≈ Ke
    g_terminal = 0.03
    base_rev = revenue[latest]

    fcf_proj = []
    prev_rev = base_rev
    prev_nwc = nwc[latest]
    avg_ebitda_margin = sum([ebitda[i] / revenue[i] for i in range(5)]) / 5
    avg_capex_pct = sum([capex[i] / revenue[i] for i in range(5)]) / 5
    avg_nwc_pct = sum([abs(nwc[i]) / revenue[i] for i in range(5)]) / 5
    tax_rate = 0.20

    for i in range(5):
        rev = prev_rev * 1.05
        ebitda_i = rev * avg_ebitda_margin
        depr_i = rev * avg_capex_pct
        ebit_i = ebitda_i - depr_i
        nopat_i = ebit_i * (1 - tax_rate)
        capex_i = rev * avg_capex_pct
        curr_nwc = rev * avg_nwc_pct
        nwc_chg = curr_nwc - abs(prev_nwc)
        fcf = nopat_i + depr_i - capex_i - nwc_chg
        fcf_proj.append(fcf)
        prev_rev = rev
        prev_nwc = curr_nwc

    pv_fcf = sum([f / ((1 + wacc) ** (i + 1)) for i, f in enumerate(fcf_proj)])
    term_fcf = fcf_proj[-1] * (1 + g_terminal)
    term_val = term_fcf / (wacc - g_terminal) if wacc > g_terminal else 0
    pv_term = term_val / ((1 + wacc) ** 5)
    ev_fcff = pv_fcf + pv_term
    eq_val_fcff = ev_fcff - 0 + total_cash_2025  # debt ≈ 0
    price_fcff = eq_val_fcff / SHARES * 1000

    print(f"  WACC: {wacc:.1%}")
    print(f"  Terminal Growth: {g_terminal:.1%}")
    print(f"  EBITDA Margin (avg): {avg_ebitda_margin:.1%}")
    print(f"  Enterprise Value: {ev_fcff:,.0f} tỷ VND")
    print(f"  + Tiền & ĐTTC:   {total_cash_2025:,.0f} tỷ VND")
    print(f"  = Equity Value:   {eq_val_fcff:,.0f} tỷ VND")
    print_separator()
    print(f"  >>> GIÁ MỤC TIÊU (FCFF): {price_fcff:,.0f} VND/CP")

    # ============================================================
    # 2. FCFE
    # ============================================================
    print_header("2. FCFE (Free Cash Flow to Equity)")

    fcfe_model = FCFEModel("BMP - Nhựa Bình Minh")
    fcfe_model.set_historical(
        years=YEARS,
        net_income=net_income,
        depreciation=depreciation,
        capex=capex,
        nwc=[abs(x) for x in nwc],
        net_borrowing=net_borrowing,
        dividends=dividends_paid,
    )

    # Compute avg ratios from historical for projections
    avg_depr_pct = sum([depreciation[i] / revenue[i] for i in range(5)]) / 5
    avg_capex_pct_rev = sum([capex[i] / revenue[i] for i in range(5)]) / 5
    avg_nwc_pct_rev = sum([abs(nwc[i]) / revenue[i] for i in range(5)]) / 5

    # NI growth: use 5% conservative
    fcfe_model.set_assumptions(
        projection_years=5,
        net_income_growth=[0.05] * 5,
        revenue_growth=[0.05] * 5,
        depr_percent_rev=[avg_depr_pct] * 5,
        capex_percent_rev=[avg_capex_pct_rev] * 5,
        nwc_percent_rev=[avg_nwc_pct_rev] * 5,
        net_borrowing_growth=[0] * 5,
        terminal_growth=0.03,
        base_revenue=revenue[latest],
    )

    fcfe_model.calculate_ke(risk_free_rate=RF, beta=BETA, market_premium=MARKET_PREMIUM)
    fcfe_model.project_fcfe()
    fcfe_result = fcfe_model.calculate_equity_value(shares_outstanding=SHARES)

    price_fcfe = fcfe_result["value_per_share"] * 1000
    print(f"  Ke: {fcfe_model.ke_components['ke']:.1%}")
    print(f"  PV FCFE: {fcfe_result['pv_fcfe']:,.0f} tỷ VND")
    print(f"  PV Terminal: {fcfe_result['pv_terminal']:,.0f} tỷ VND")
    print(f"  Equity Value: {fcfe_result['equity_value']:,.0f} tỷ VND")
    print_separator()
    print(f"  >>> GIÁ MỤC TIÊU (FCFE): {price_fcfe:,.0f} VND/CP")

    # ============================================================
    # 3. P/E Valuation
    # ============================================================
    print_header("3. P/E (Price-to-Earnings)")

    rel_model = RelativeValuation("BMP - Nhựa Bình Minh")
    rel_model.set_financials(
        eps=eps_2025,
        bvps=bvps_2025,
        ebitda=ebitda_2025,
        net_debt=net_debt_2025,
        cash=total_cash_2025,
        shares_outstanding=SHARES,
        net_income=net_income[latest],
        book_value=equity[latest],
        revenue=revenue[latest],
    )
    rel_model.set_peer_multiples(PEER_MULTIPLES)

    pe_result = rel_model.valuation_pe()
    print(f"  EPS 2025: {eps_2025:,.0f} VND")
    if "target_price" in pe_result:
        print(f"  P/E bội số (peer avg): {pe_result['target_pe']:.1f}x")
        price_pe = pe_result["target_price"]
        print_separator()
        print(f"  >>> GIÁ MỤC TIÊU (P/E): {price_pe:,.0f} VND/CP")
    else:
        price_pe = 0
        print(f"  Error: {pe_result.get('error', 'Unknown')}")

    # ============================================================
    # 4. P/B Valuation
    # ============================================================
    print_header("4. P/B (Price-to-Book)")

    pb_result = rel_model.valuation_pb()
    print(f"  BVPS 2025: {bvps_2025:,.0f} VND")
    if "target_price" in pb_result:
        print(f"  P/B bội số (peer avg): {pb_result['target_pb']:.1f}x")
        price_pb = pb_result["target_price"]
        print_separator()
        print(f"  >>> GIÁ MỤC TIÊU (P/B): {price_pb:,.0f} VND/CP")
    else:
        price_pb = 0
        print(f"  Error: {pb_result.get('error', 'Unknown')}")

    # ============================================================
    # 4b. EV/EBITDA (Bonus)
    # ============================================================
    print_header("4b. EV/EBITDA")

    ev_result = rel_model.valuation_ev_ebitda()
    print(f"  EBITDA 2025: {ebitda_2025:,.0f} tỷ VND")
    if "target_price" in ev_result:
        print(f"  EV/EBITDA bội số (peer avg): {ev_result['target_multiple']:.1f}x")
        price_ev_ebitda = ev_result["target_price"]
        print_separator()
        print(f"  >>> GIÁ MỤC TIÊU (EV/EBITDA): {price_ev_ebitda:,.0f} VND/CP")
    else:
        price_ev_ebitda = 0
        print(f"  Error: {ev_result.get('error', 'Unknown')}")

    # ============================================================
    # 5. DDM (Dividend Discount Model)
    # ============================================================
    print_header("5. DDM (Dividend Discount Model)")

    ddm = DDMModel("BMP - Nhựa Bình Minh")
    ddm.set_historical_dividends(
        years=YEARS,
        dividends_paid=dividends_paid,
        net_income=net_income,
        shares_outstanding=SHARES,
    )
    ddm.calculate_ke(risk_free_rate=RF, beta=BETA, market_premium=MARKET_PREMIUM)

    # Historical dividend info
    print(f"  DPS lịch sử:")
    for i, yr in enumerate(YEARS):
        dps_i = dividends_paid[i] / SHARES * 1000
        payout_i = dividends_paid[i] / net_income[i] * 100 if net_income[i] > 0 else 0
        print(f"    {yr}: DPS = {dps_i:,.0f} VND (Payout {payout_i:.0f}%)")

    # Gordon Growth
    gordon = ddm.gordon_growth(g=0.03)
    if "target_price" in gordon:
        price_ddm_gordon = gordon["target_price"]
        print(f"\n  Gordon Growth (g=3%): {price_ddm_gordon:,.0f} VND/CP")
    else:
        price_ddm_gordon = 0
        print(f"\n  Gordon Growth: {gordon.get('error', 'Error')}")

    # Two-Stage
    two_stage = ddm.two_stage_ddm(g_high=0.08, g_stable=0.03, high_growth_years=5)
    if "target_price" in two_stage:
        price_ddm_2stage = two_stage["target_price"]
        print(f"  Two-Stage DDM (8%→3%): {price_ddm_2stage:,.0f} VND/CP")
    else:
        price_ddm_2stage = 0
        print(f"  Two-Stage: {two_stage.get('error', 'Error')}")

    # H-Model
    h_model = ddm.h_model(g_high=0.08, g_stable=0.03, half_life_years=6)
    if "target_price" in h_model:
        price_ddm_h = h_model["target_price"]
        print(f"  H-Model (8%→3%, H=6yr): {price_ddm_h:,.0f} VND/CP")
    else:
        price_ddm_h = 0
        print(f"  H-Model: {h_model.get('error', 'Error')}")

    # DDM average
    ddm_prices = [p for p in [price_ddm_gordon, price_ddm_2stage, price_ddm_h] if p > 0]
    price_ddm_avg = sum(ddm_prices) / len(ddm_prices) if ddm_prices else 0
    print_separator()
    print(f"  >>> GIÁ MỤC TIÊU (DDM Avg): {price_ddm_avg:,.0f} VND/CP")

    # ============================================================
    # TỔNG HỢP
    # ============================================================
    print_header("BẢNG TỔNG HỢP GIÁ MỤC TIÊU")

    all_prices = {
        "FCFF (DCF)": price_fcff,
        "FCFE": price_fcfe,
        "P/E": price_pe,
        "P/B": price_pb,
        "EV/EBITDA": price_ev_ebitda,
        "DDM (Gordon)": price_ddm_gordon,
        "DDM (Two-Stage)": price_ddm_2stage,
        "DDM (H-Model)": price_ddm_h,
    }

    print(f"  {'Phương pháp':<20} {'Giá mục tiêu (VND)':>20}")
    print("  " + "-" * 42)
    for method, price in all_prices.items():
        if price > 0:
            print(f"  {method:<20} {price:>20,.0f}")
        else:
            print(f"  {method:<20} {'N/A':>20}")

    valid_prices = [p for p in all_prices.values() if p > 0]
    if valid_prices:
        avg_price = sum(valid_prices) / len(valid_prices)
        min_price = min(valid_prices)
        max_price = max(valid_prices)

        print("  " + "-" * 42)
        print(f"  {'FAIR VALUE RANGE':<20}")
        print(f"    Low:  {min_price:>17,.0f} VND")
        print(f"    Avg:  {avg_price:>17,.0f} VND")
        print(f"    High: {max_price:>17,.0f} VND")

    print("\n" + "=" * 65)

    # ============================================================
    # SENSITIVITY: FCFE Ke vs Terminal Growth
    # ============================================================
    print_header("PHÂN TÍCH ĐỘ NHẠY - FCFE")
    print("  Giá mục tiêu (VND) theo Ke (hàng) vs g (cột)")
    print()

    ke_range = [0.09, 0.10, 0.11, 0.12, 0.13]
    g_range = [0.02, 0.03, 0.04]

    header = f"  {'Ke \\\\ g':<10}"
    for g in g_range:
        header += f"{'g=' + f'{g:.0%}':>14}"
    print(header)
    print("  " + "-" * 52)

    sens_results = fcfe_model.sensitivity_analysis(ke_range, g_range, SHARES)
    for i, ke_val in enumerate(ke_range):
        row = f"  Ke={ke_val:.0%}    "
        for j in range(len(g_range)):
            price = sens_results[i][j] * 1000
            row += f"{price:>14,.0f}"
        print(row)

    # ============================================================
    # SENSITIVITY: DDM Gordon Ke vs g
    # ============================================================
    print_header("PHÂN TÍCH ĐỘ NHẠY - DDM Gordon")
    d0 = dividends_paid[-1] / SHARES * 1000  # DPS 2025
    print(f"  D₀ = {d0:,.0f} VND/CP")
    print(f"  Giá mục tiêu (VND) theo Ke (hàng) vs g (cột)")
    print()

    header2 = f"  {'Ke \\\\ g':<10}"
    for g in g_range:
        header2 += f"{'g=' + f'{g:.0%}':>14}"
    print(header2)
    print("  " + "-" * 52)

    ddm_sens = ddm.sensitivity_gordon(d0, ke_range, g_range)
    for i, ke_val in enumerate(ke_range):
        row = f"  Ke={ke_val:.0%}    "
        for j in range(len(g_range)):
            val = ddm_sens[i][j]
            if val is None:
                row += f"{'N/A':>14}"
            else:
                row += f"{val:>14,.0f}"
        print(row)

    print("\n" + "=" * 65)
    print("  Disclaimer: Mô hình chỉ mang tính tham khảo. Không phải")
    print("  khuyến nghị đầu tư. Kết quả phụ thuộc vào các giả định.")
    print("=" * 65)


if __name__ == "__main__":
    main()
